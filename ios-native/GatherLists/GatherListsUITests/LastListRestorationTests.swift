import XCTest

/// XCUITest cases for last-viewed-list restoration across app launches.
///
/// Regression coverage for the bug where viewing a list never persisted it as the
/// last-viewed list (`ListViewModel.selectList` had no callers), so relaunching the
/// app failed to restore the list the user was in. Restoration works by:
/// 1. `ListDetailView.task` calling `selectList(id:)`, which caches the ID in
///    UserDefaults immediately and upserts to Supabase (debounced).
/// 2. On launch, `ListViewModel.loadData()` reading the cached ID and setting
///    `activeListId`, which `ListBrowserView` observes to auto-navigate.
///
/// **PREREQUISITES FOR RUNNING THESE TESTS:**
///
/// Same as `ListDetailViewCollaboratorMenuTests`: a test user authenticated in
/// `setUpWithError()` (persisted keychain session or `TEST_USER_EMAIL` /
/// `TEST_USER_PASSWORD` launch environment) with at least 2 lists, so the test
/// can prove restoration targets the *viewed* list rather than the first one.
final class LastListRestorationTests: XCTestCase {

    // MARK: - Properties

    private let app = XCUIApplication()

    /// Title of the list browser's navigation bar (the non-detail state).
    private let browserTitle = "Lists"

    // MARK: - Setup & Teardown

    override func setUpWithError() throws {
        continueAfterFailure = false

        app.launchEnvironment["TEST_USER_EMAIL"] = ProcessInfo.processInfo.environment["TEST_USER_EMAIL"] ?? "collaborator@example.com"
        app.launchEnvironment["TEST_USER_PASSWORD"] = ProcessInfo.processInfo.environment["TEST_USER_PASSWORD"] ?? "testpassword123"

        app.launch()
        try waitForListsToLoad()
    }

    override func tearDownWithError() throws {
        // Capture screenshot on test failure for debugging
        if let currentTest = testRun, currentTest.failureCount > 0 {
            let screenshot = app.screenshot()
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        try super.tearDownWithError()
    }

    // MARK: - Tests

    /// Open a list (not the first, so the assertion can't pass via the
    /// first-list fallback), terminate the app, relaunch, and verify the app
    /// auto-navigates back into the same list.
    func testRelaunchRestoresLastViewedList() throws {
        let listTitle = try openListAndCaptureTitle(preferredIndex: 1)

        app.terminate()
        app.launch()

        assertRestores(to: listTitle)
    }

    /// Open one list, go back, open a different list, then relaunch.
    /// The app must restore the most recently viewed list, not the earlier one.
    func testRelaunchRestoresMostRecentlyViewedList() throws {
        let firstViewed = try openListAndCaptureTitle(preferredIndex: 0)
        returnToBrowser()
        let secondViewed = try openListAndCaptureTitle(preferredIndex: 1)
        try XCTSkipIf(
            secondViewed == firstViewed,
            "Needs two distinct lists to verify most-recent-wins restoration"
        )

        app.terminate()
        app.launch()

        assertRestores(to: secondViewed)
    }

    // MARK: - Helpers

    /// Waits for the list browser (or login fallback) to be ready after launch.
    private func waitForListsToLoad() throws {
        let browserBar = app.navigationBars[browserTitle]
        let detailRestored = app.navigationBars.firstMatch

        // Either the browser appears, or restoration already pushed a detail view.
        for _ in 0..<15 {
            if browserBar.exists || detailRestored.exists {
                return
            }
            if app.secureTextFields.firstMatch.exists {
                try performLogin()
                continue
            }
            Thread.sleep(forTimeInterval: 1)
        }
        XCTFail("App did not reach the lists UI within the timeout")
    }

    /// Signs in using launch-environment credentials when the session is not persisted.
    private func performLogin() throws {
        let email = app.launchEnvironment["TEST_USER_EMAIL"] ?? ""
        let password = app.launchEnvironment["TEST_USER_PASSWORD"] ?? ""

        let emailField = app.textFields.firstMatch
        let passwordField = app.secureTextFields.firstMatch
        let signInButton = app.buttons.matching(
            NSPredicate(format: "label CONTAINS 'Sign In' OR label CONTAINS 'Login'")
        ).firstMatch

        guard emailField.exists, passwordField.exists else { return }

        emailField.tap()
        emailField.typeText(email)
        passwordField.tap()
        passwordField.typeText(password)
        if signInButton.exists {
            signInButton.tap()
        }
        Thread.sleep(forTimeInterval: 2)
    }

    /// Ensures the list browser is showing, popping a restored detail view if needed.
    private func returnToBrowser() {
        let browserBar = app.navigationBars[browserTitle]
        if browserBar.exists { return }

        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        if backButton.exists {
            backButton.tap()
        }
        XCTAssertTrue(
            browserBar.waitForExistence(timeout: 5),
            "Could not return to the list browser"
        )
    }

    /// Taps the list row at `preferredIndex` (falling back to the first row) and
    /// returns the detail view's navigation title once it is pushed.
    private func openListAndCaptureTitle(preferredIndex: Int) throws -> String {
        // Launch restoration may already be inside a detail view; start from the browser.
        if !app.navigationBars[browserTitle].exists {
            returnToBrowser()
        }

        // List rows render an "N items" subtitle (same query as the collaborator menu tests).
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        XCTAssertTrue(
            listCells.firstMatch.waitForExistence(timeout: 10),
            "Expected at least one list row in the browser"
        )

        let index = listCells.count > preferredIndex ? preferredIndex : 0
        listCells.element(boundBy: index).tap()

        // The detail nav bar replaces the "Lists" bar; its title is the list name.
        let detailBar = app.navigationBars.element(boundBy: 0)
        for _ in 0..<10 {
            if detailBar.exists, detailBar.identifier != browserTitle, !detailBar.identifier.isEmpty {
                return detailBar.identifier
            }
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTFail("Detail view did not appear after tapping a list row")
        return ""
    }

    /// Asserts that a fresh launch lands inside the list whose title is `listTitle`.
    private func assertRestores(to listTitle: String) {
        let restoredBar = app.navigationBars[listTitle]
        XCTAssertTrue(
            // Generous timeout: restore navigation runs after the lists fetch completes.
            restoredBar.waitForExistence(timeout: 20),
            "Relaunch should restore the last viewed list '\(listTitle)'"
        )
        XCTAssertFalse(
            app.navigationBars[browserTitle].exists,
            "App should be inside the restored list, not the list browser"
        )
    }
}

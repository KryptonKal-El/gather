import XCTest

/// XCUITest coverage for rotating the app on iPad.
///
/// iPhone is portrait-only, so these tests skip there. On iPad the app supports
/// all four orientations; each test rotates through landscape and back to portrait
/// and checks the primary controls stay on screen and tappable, attaching a
/// screenshot per orientation (and per tab when signed in) for visual review.
///
/// Uses whatever session the simulator already has: signed out it checks the
/// login screen, signed in it walks every tab.
final class IPadOrientationTests: XCTestCase {

    // MARK: - Properties

    private let app = XCUIApplication()

    private let orientations: [(UIDeviceOrientation, String)] = [
        (.landscapeLeft, "landscape-left"),
        (.portrait, "portrait"),
        (.landscapeRight, "landscape-right"),
        (.portrait, "portrait-again")
    ]

    /// Tab bar items by name, keyed to their SF Symbol identifiers so they don't
    /// collide with same-named back buttons (e.g. "Lists").
    private let tabs: [(name: String, icon: String)] = [
        ("Lists", "list.bullet"),
        ("Recipes", "book"),
        ("Plan", "calendar"),
        ("Settings", "gearshape")
    ]

    // MARK: - Setup & Teardown

    override func setUpWithError() throws {
        continueAfterFailure = true
        try XCTSkipUnless(UIDevice.current.userInterfaceIdiom == .pad, "Rotation is iPad-only")
        XCUIDevice.shared.orientation = .portrait
        app.launch()
    }

    override func tearDownWithError() throws {
        XCUIDevice.shared.orientation = .portrait
    }

    // MARK: - Tests

    func testRotatingKeepsScreensUsable() throws {
        let listsTab = tabButton(icon: "list.bullet")
        let isSignedIn = listsTab.waitForExistence(timeout: 10)

        for (orientation, label) in orientations {
            XCUIDevice.shared.orientation = orientation
            // Let the rotation animation and relayout finish before inspecting.
            Thread.sleep(forTimeInterval: 1.5)

            if isSignedIn {
                for tab in tabs {
                    let button = tabButton(icon: tab.icon)
                    XCTAssertTrue(button.isHittable, "\(tab.name) tab not tappable in \(label)")
                    button.tap()
                    Thread.sleep(forTimeInterval: 1)
                    attachScreenshot(named: "\(label)-\(tab.name)")
                }
            } else {
                XCTAssertTrue(app.buttons["Sign In"].isHittable, "Sign In not tappable in \(label)")
                attachScreenshot(named: "\(label)-login")
            }
        }
    }

    // MARK: - Helpers

    private func tabButton(icon: String) -> XCUIElement {
        app.buttons.matching(identifier: icon).firstMatch
    }

    private func attachScreenshot(named name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

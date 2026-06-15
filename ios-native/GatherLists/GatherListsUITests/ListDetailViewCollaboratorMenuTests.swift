import XCTest

/// XCUITest cases for the collaborator 3-dot menu in ListDetailView.
/// 
/// These tests verify that:
/// - Collaborators (non-owners) see the collaborator menu with limited options
/// - Owners see the full owner menu with additional privileged options
/// - Menu items are present/absent based on list type configuration
///
/// **PREREQUISITES FOR RUNNING THESE TESTS:**
/// 
/// These tests require pre-existing test data in the Supabase backend. Before running:
/// 1. Create two test users:
///    - User A (collaborator): email (to be authenticated in setUpWithError)
///    - User B (owner): email
/// 
/// 2. Create the following shared lists in the database:
///    - A "grocery" list owned by User B, shared with User A as a collaborator
///    - A "todo" list (no stores) owned by User B, shared with User A as a collaborator
///    - A "packing" list (has stores AND categories) owned by User B, shared with User A as a collaborator
///    - A "guest_list" owned by User B, shared with User A as a collaborator
///    - A "basic" list (no stores, no categories) owned by User B, shared with User A as a collaborator
///    - A "grocery" list owned by User A
///    - A "guest_list" owned by User A
/// 
/// 3. Set LaunchEnvironment variables for authentication (if using mock auth):
///    - `TEST_USER_EMAIL`: collaborator email
///    - `TEST_USER_PASSWORD`: collaborator password
///    - `SKIP_REAL_AUTH`: "1" to use local auth (if app supports it)
/// 
/// If your app does NOT support environment-based auth, you may need to:
/// - Authenticate manually in setUpWithError() using LoginView
/// - Use hardcoded test credentials or mock Supabase responses
/// - Set up a test backend with fixture data loaded before tests run
final class ListDetailViewCollaboratorMenuTests: XCTestCase {
    
    // MARK: - Properties
    
    private let app = XCUIApplication()
    
    // MARK: - Setup & Teardown
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        
        // Configure launch environment for testing
        // Note: Update these credentials to match your test Supabase backend
        app.launchEnvironment["TEST_USER_EMAIL"] = "collaborator@example.com"
        app.launchEnvironment["TEST_USER_PASSWORD"] = "testpassword123"
        
        app.launch()
        
        // Wait for app to load and authenticate
        // If your app supports environment-based auth, it should log in automatically
        // Otherwise, perform manual login here
        try waitForListsViewToLoad()
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
    
    // MARK: - Helper: Wait for Lists View
    
    private func waitForListsViewToLoad() throws {
        // Wait for the lists view to appear by checking for the first list
        // or the empty state. The app should show either a list of lists or an empty state.
        var found = false

        // Give up to 10 seconds for the view to load
        for _ in 0..<10 {
            if app.staticTexts.containing(NSPredicate(format: "label CONTAINS 'items'")).count > 0 ||
               app.staticTexts["Lists"].exists {
                found = true
                break
            }
            Thread.sleep(forTimeInterval: 1)
        }

        if !found {
            // If lists aren't found, the user may still be on LoginView
            // Attempt to authenticate if needed
            let emailField = app.textFields.firstMatch
            if emailField.exists {
                try performLogin()
            }
        }
    }
    
    // MARK: - Helper: Perform Login
    
    private func performLogin() throws {
        let email = ProcessInfo.processInfo.environment["TEST_USER_EMAIL"] ?? "collaborator@example.com"
        let password = ProcessInfo.processInfo.environment["TEST_USER_PASSWORD"] ?? "testpassword123"
        
        // Find email and password fields
        let emailField = app.textFields.firstMatch
        let passwordField = app.secureTextFields.firstMatch
        let signInButton = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Sign In' OR label CONTAINS 'Login'")).firstMatch
        
        if emailField.exists && passwordField.exists {
            emailField.tap()
            emailField.typeText(email)
            
            passwordField.tap()
            passwordField.typeText(password)
            
            if signInButton.exists {
                signInButton.tap()
            }
            
            // Wait for authentication to complete
            Thread.sleep(forTimeInterval: 2)
        }
    }
    
    // MARK: - Tests: Collaborator Menu Presence
    
    /// Test that the collaborator sees the 3-dot menu button (not the pencil button).
    func testCollaboratorSeesThreeDotMenuButton() throws {
        // Navigate to a list where the current user is a collaborator
        navigateToCollaboratorList()
        
        // Verify the collaborator menu button exists
        let collaboratorMenuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(
            collaboratorMenuButton.waitForExistence(timeout: 5),
            "Collaborator should see the 3-dot menu button"
        )
        
        // Verify the owner menu button is NOT visible
        let ownerMenuButton = app.buttons["listDetail-ownerMenuButton"]
        XCTAssertFalse(
            ownerMenuButton.exists,
            "Collaborator should not see the owner menu button"
        )
    }
    
    /// Test that the owner sees the owner menu button (not the collaborator menu).
    func testOwnerSeesOwnerMenuButton() throws {
        // Navigate to a list where the current user is the owner
        navigateToOwnedList()
        
        // Verify the owner menu button exists
        let ownerMenuButton = app.buttons["listDetail-ownerMenuButton"]
        XCTAssertTrue(
            ownerMenuButton.waitForExistence(timeout: 5),
            "Owner should see the owner menu button"
        )
        
        // Verify the collaborator menu button is NOT visible
        let collaboratorMenuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertFalse(
            collaboratorMenuButton.exists,
            "Owner should not see the collaborator menu button"
        )
    }
    
    // MARK: - Tests: Collaborator Menu Items
    
    /// Test that collaborator menu contains "Name, Icon & Color" option.
    func testCollaboratorMenuContainsEditNameIconColor() throws {
        navigateToCollaboratorList()
        
        let menuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        // Wait for the menu to appear
        let editNameButton = app.buttons["collaboratorMenu-editNameIconColor"]
        XCTAssertTrue(
            editNameButton.waitForExistence(timeout: 5),
            "Collaborator menu should contain 'Name, Icon & Color' option"
        )
    }
    
    /// Test that collaborator menu contains "Manage Stores" for applicable list types.
    func testCollaboratorMenuContainsManageStoresWhenApplicable() throws {
        // Navigate to a list type that has stores (e.g., shopping list)
        navigateToCollaboratorListWithStores()
        
        let menuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let manageStoresButton = app.buttons["collaboratorMenu-manageStores"]
        XCTAssertTrue(
            manageStoresButton.waitForExistence(timeout: 5),
            "Collaborator menu should contain 'Manage Stores' for list types with stores"
        )
    }
    
    /// Test that collaborator menu does NOT contain "Manage Stores" for non-applicable list types.
    func testCollaboratorMenuDoesNotContainManageStoresWhenNotApplicable() throws {
        // Navigate to a list type that does not have stores
        navigateToCollaboratorListWithoutStores()
        
        let menuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let manageStoresButton = app.buttons["collaboratorMenu-manageStores"]
        XCTAssertFalse(
            manageStoresButton.exists,
            "Collaborator menu should not contain 'Manage Stores' for list types without stores"
        )
    }
    
    /// Test that collaborator menu contains "Manage Categories" for applicable list types.
    func testCollaboratorMenuContainsManageCategoriesWhenApplicable() throws {
        // Navigate to a list type that supports categories (e.g., packing list, bucket list)
        navigateToCollaboratorListWithCategories()
        
        let menuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let manageCategoriesButton = app.buttons["collaboratorMenu-manageCategories"]
        XCTAssertTrue(
            manageCategoriesButton.waitForExistence(timeout: 5),
            "Collaborator menu should contain 'Manage Categories' for applicable list types"
        )
    }
    
    /// Test that collaborator menu does NOT contain "Manage Categories" for non-applicable list types.
    func testCollaboratorMenuDoesNotContainManageCategoriesWhenNotApplicable() throws {
        // Navigate to a list type that does not support categories
        navigateToCollaboratorListWithoutCategories()
        
        let menuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let manageCategoriesButton = app.buttons["collaboratorMenu-manageCategories"]
        XCTAssertFalse(
            manageCategoriesButton.exists,
            "Collaborator menu should not contain 'Manage Categories' for list types that don't support categories"
        )
    }
    
    // MARK: - Tests: Collaborator Menu Does NOT Contain Owner-Only Options
    
    /// Test that collaborator menu does NOT contain "Share Settings".
    func testCollaboratorMenuDoesNotContainShareSettings() throws {
        navigateToCollaboratorList()
        
        let menuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let shareSettingsButton = app.buttons["ownerMenu-shareSettings"]
        XCTAssertFalse(
            shareSettingsButton.exists,
            "Collaborator menu should not contain 'Share Settings' option"
        )
    }
    
    /// Test that collaborator menu does NOT contain "Delete List".
    func testCollaboratorMenuDoesNotContainDeleteList() throws {
        navigateToCollaboratorList()
        
        let menuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let deleteListButton = app.buttons["ownerMenu-deleteList"]
        XCTAssertFalse(
            deleteListButton.exists,
            "Collaborator menu should not contain 'Delete List' option"
        )
    }
    
    /// Test that collaborator menu does NOT contain "Reset Items" (owner-only for guest lists).
    func testCollaboratorMenuDoesNotContainResetItems() throws {
        // Navigate to a guest list where the user is a collaborator
        navigateToCollaboratorGuestList()
        
        let menuButton = app.buttons["listDetail-collaboratorMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let resetItemsButton = app.buttons["ownerMenu-resetItems"]
        XCTAssertFalse(
            resetItemsButton.exists,
            "Collaborator menu should not contain 'Reset Items' option"
        )
    }
    
    // MARK: - Tests: Owner Menu Contains All Options
    
    /// Test that owner menu contains all expected options including "Share Settings".
    func testOwnerMenuContainsShareSettings() throws {
        navigateToOwnedList()
        
        let menuButton = app.buttons["listDetail-ownerMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let shareSettingsButton = app.buttons["ownerMenu-shareSettings"]
        XCTAssertTrue(
            shareSettingsButton.waitForExistence(timeout: 5),
            "Owner menu should contain 'Share Settings' option"
        )
    }
    
    /// Test that owner menu contains "Delete List" option.
    func testOwnerMenuContainsDeleteList() throws {
        navigateToOwnedList()
        
        let menuButton = app.buttons["listDetail-ownerMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let deleteListButton = app.buttons["ownerMenu-deleteList"]
        XCTAssertTrue(
            deleteListButton.waitForExistence(timeout: 5),
            "Owner menu should contain 'Delete List' option"
        )
    }
    
    /// Test that owner menu contains "Reset Items" for guest lists.
    func testOwnerMenuContainsResetItemsForGuestList() throws {
        navigateToOwnedGuestList()
        
        let menuButton = app.buttons["listDetail-ownerMenuButton"]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 5))
        menuButton.tap()
        
        let resetItemsButton = app.buttons["ownerMenu-resetItems"]
        XCTAssertTrue(
            resetItemsButton.waitForExistence(timeout: 5),
            "Owner menu should contain 'Reset Items' option for guest lists"
        )
    }
    
    // MARK: - Navigation Helper Methods
    
    /// Navigate to a list where the current user is a collaborator (not owner).
    /// 
    /// Queries for any shared list in the browser and taps to navigate to detail view.
    private func navigateToCollaboratorList() {
        // Query for any list cell in the browser. Shared lists typically appear after owned lists.
        // Use XCUITest to find a list that is NOT the first one (first is usually owned by current user)
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        
        // Try to find a collaborator list by tapping on a list after the first
        if listCells.count > 1 {
            // Tap the second list (typically a shared/collaborator list)
            let secondList = listCells.element(boundBy: 1)
            let listRow = secondList.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            listRow.tap()
        } else if listCells.count > 0 {
            // Fallback: tap the first list
            let firstList = listCells.firstMatch
            firstList.tap()
        }
        
        // Wait for ListDetailView to load
        let collaboratorMenuButton = app.buttons["listDetail-collaboratorMenuButton"]
        _ = collaboratorMenuButton.waitForExistence(timeout: 5)
    }
    
    /// Navigate to a list where the current user is the owner.
    private func navigateToOwnedList() {
        // The first list is typically owned by the current user in the browser
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        
        if listCells.count > 0 {
            let firstList = listCells.firstMatch
            // Tap on the list name or row to navigate
            firstList.tap()
        }
        
        // Wait for ListDetailView to load with owner menu button
        let ownerMenuButton = app.buttons["listDetail-ownerMenuButton"]
        _ = ownerMenuButton.waitForExistence(timeout: 5)
    }
    
    /// Navigate to a collaborator list of a type that has stores (e.g., grocery, packing, project).
    /// Prefers "grocery" type if available, falls back to "packing" or "project".
    private func navigateToCollaboratorListWithStores() {
        // Lists with stores: grocery, packing, project
        // Strategy: scan all lists and find one that's a collaborator list with a store-supporting type
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        
        // Look for a list that likely has stores (look for specific labels or try each)
        // Without list type labels directly accessible, try a known pattern
        // First, navigate to any collaborator list and check its menu
        for index in 1..<listCells.count {
            let list = listCells.element(boundBy: index)
            list.tap()
            
            // Check if collaborator menu button exists
            let collaboratorMenuButton = app.buttons["listDetail-collaboratorMenuButton"]
            if collaboratorMenuButton.waitForExistence(timeout: 2) {
                // Tap menu to see if "Manage Stores" is available
                collaboratorMenuButton.tap()
                let manageStoresButton = app.buttons["collaboratorMenu-manageStores"]
                if manageStoresButton.exists {
                    // Found a collaborator list with stores! Keep this navigation.
                    return
                } else {
                    // This list doesn't have stores, go back and try the next one
                    app.navigationBars.buttons.element(boundBy: 0).tap()
                    Thread.sleep(forTimeInterval: 0.5)
                }
            } else {
                // This is an owned list, go back and try the next
                app.navigationBars.buttons.element(boundBy: 0).tap()
                Thread.sleep(forTimeInterval: 0.5)
            }
        }
        
        // Fallback: if no suitable list found, navigate to first collaborator list
        navigateToCollaboratorList()
    }
    
    /// Navigate to a collaborator list of a type that does NOT have stores (e.g., basic, todo, guest_list).
    private func navigateToCollaboratorListWithoutStores() {
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        
        // Look for a collaborator list without stores
        for index in 1..<listCells.count {
            let list = listCells.element(boundBy: index)
            list.tap()
            
            let collaboratorMenuButton = app.buttons["listDetail-collaboratorMenuButton"]
            if collaboratorMenuButton.waitForExistence(timeout: 2) {
                collaboratorMenuButton.tap()
                let manageStoresButton = app.buttons["collaboratorMenu-manageStores"]
                if !manageStoresButton.exists {
                    // Found a collaborator list WITHOUT stores! Keep this navigation.
                    return
                } else {
                    // This list has stores, go back and try the next one
                    app.navigationBars.buttons.element(boundBy: 0).tap()
                    Thread.sleep(forTimeInterval: 0.5)
                }
            } else {
                // This is an owned list, go back and try the next
                app.navigationBars.buttons.element(boundBy: 0).tap()
                Thread.sleep(forTimeInterval: 0.5)
            }
        }
        
        // Fallback: navigate to first collaborator list
        navigateToCollaboratorList()
    }
    
    /// Navigate to a collaborator list of a type that supports categories (e.g., grocery, packing, todo, project).
    private func navigateToCollaboratorListWithCategories() {
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        
        // Look for a collaborator list with categories
        for index in 1..<listCells.count {
            let list = listCells.element(boundBy: index)
            list.tap()
            
            let collaboratorMenuButton = app.buttons["listDetail-collaboratorMenuButton"]
            if collaboratorMenuButton.waitForExistence(timeout: 2) {
                collaboratorMenuButton.tap()
                let manageCategoriesButton = app.buttons["collaboratorMenu-manageCategories"]
                if manageCategoriesButton.exists {
                    // Found a collaborator list with categories! Keep this navigation.
                    return
                } else {
                    // This list doesn't support categories, go back and try the next one
                    app.navigationBars.buttons.element(boundBy: 0).tap()
                    Thread.sleep(forTimeInterval: 0.5)
                }
            } else {
                // This is an owned list, go back and try the next
                app.navigationBars.buttons.element(boundBy: 0).tap()
                Thread.sleep(forTimeInterval: 0.5)
            }
        }
        
        // Fallback: navigate to first collaborator list
        navigateToCollaboratorList()
    }
    
    /// Navigate to a collaborator list of a type that does NOT support categories.
    private func navigateToCollaboratorListWithoutCategories() {
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        
        // Look for a collaborator list without categories
        for index in 1..<listCells.count {
            let list = listCells.element(boundBy: index)
            list.tap()
            
            let collaboratorMenuButton = app.buttons["listDetail-collaboratorMenuButton"]
            if collaboratorMenuButton.waitForExistence(timeout: 2) {
                collaboratorMenuButton.tap()
                let manageCategoriesButton = app.buttons["collaboratorMenu-manageCategories"]
                if !manageCategoriesButton.exists {
                    // Found a collaborator list WITHOUT categories! Keep this navigation.
                    return
                } else {
                    // This list has categories, go back and try the next one
                    app.navigationBars.buttons.element(boundBy: 0).tap()
                    Thread.sleep(forTimeInterval: 0.5)
                }
            } else {
                // This is an owned list, go back and try the next
                app.navigationBars.buttons.element(boundBy: 0).tap()
                Thread.sleep(forTimeInterval: 0.5)
            }
        }
        
        // Fallback: navigate to first collaborator list
        navigateToCollaboratorList()
    }
    
    /// Navigate to a guest list where the user is a collaborator.
    private func navigateToCollaboratorGuestList() {
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        
        // Look for a collaborator guest list
        // Guest lists have specific characteristics but we query by checking menu items
        for index in 1..<listCells.count {
            let list = listCells.element(boundBy: index)
            list.tap()
            
            let collaboratorMenuButton = app.buttons["listDetail-collaboratorMenuButton"]
            if collaboratorMenuButton.waitForExistence(timeout: 2) {
                // This is a collaborator list, but we need to verify it's a guest list
                // Look for RSVP-related UI elements that are specific to guest lists
                let rsvpElements = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Confirmed' OR label CONTAINS 'Declined' OR label CONTAINS 'Maybe' OR label CONTAINS 'Not Yet Invited'"))
                if rsvpElements.count > 0 {
                    // This is likely a guest list!
                    return
                } else {
                    // Not a guest list, try next
                    app.navigationBars.buttons.element(boundBy: 0).tap()
                    Thread.sleep(forTimeInterval: 0.5)
                }
            } else {
                // This is an owned list, go back and try the next
                app.navigationBars.buttons.element(boundBy: 0).tap()
                Thread.sleep(forTimeInterval: 0.5)
            }
        }
        
        // Fallback: navigate to first collaborator list
        navigateToCollaboratorList()
    }
    
    /// Navigate to a guest list where the current user is the owner.
    private func navigateToOwnedGuestList() {
        let listCells = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'items'"))
        
        // Look for an owned guest list
        for index in 0..<listCells.count {
            let list = listCells.element(boundBy: index)
            list.tap()
            
            let ownerMenuButton = app.buttons["listDetail-ownerMenuButton"]
            if ownerMenuButton.waitForExistence(timeout: 2) {
                // This is an owned list, check if it's a guest list
                let rsvpElements = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Confirmed' OR label CONTAINS 'Declined' OR label CONTAINS 'Maybe' OR label CONTAINS 'Not Yet Invited'"))
                if rsvpElements.count > 0 {
                    // This is an owned guest list!
                    return
                } else {
                    // Not a guest list, try next
                    app.navigationBars.buttons.element(boundBy: 0).tap()
                    Thread.sleep(forTimeInterval: 0.5)
                }
            } else {
                // This is a collaborator list, go back and try the next
                app.navigationBars.buttons.element(boundBy: 0).tap()
                Thread.sleep(forTimeInterval: 0.5)
            }
        }
        
        // Fallback: navigate to first owned list
        navigateToOwnedList()
    }
}

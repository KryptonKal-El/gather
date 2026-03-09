import Foundation

struct RecipeTemplate: Identifiable {
    let id: String
    let name: String
    let description: String
    let ingredients: [String]
    
    static let all: [RecipeTemplate] = [
        RecipeTemplate(
            id: "spaghetti-bolognese",
            name: "Spaghetti Bolognese",
            description: "Classic Italian pasta with meat sauce",
            ingredients: ["spaghetti", "ground beef", "tomato sauce", "onion", "garlic", "olive oil", "parmesan", "salt", "pepper", "basil"]
        ),
        RecipeTemplate(
            id: "chicken-stir-fry",
            name: "Chicken Stir Fry",
            description: "Quick and easy weeknight dinner",
            ingredients: ["chicken breast", "broccoli", "bell pepper", "soy sauce", "garlic", "ginger", "rice", "vegetable oil", "sesame oil"]
        ),
        RecipeTemplate(
            id: "tacos",
            name: "Tacos",
            description: "Build-your-own taco night",
            ingredients: ["ground beef", "tortillas", "cheese", "lettuce", "tomatoes", "sour cream", "salsa", "onion", "cilantro", "lime"]
        ),
        RecipeTemplate(
            id: "caesar-salad",
            name: "Caesar Salad",
            description: "Classic caesar with homemade dressing",
            ingredients: ["romaine lettuce", "parmesan", "croutons", "lemon", "garlic", "olive oil", "anchovy paste", "eggs"]
        ),
        RecipeTemplate(
            id: "pancakes",
            name: "Pancakes",
            description: "Fluffy breakfast pancakes",
            ingredients: ["flour", "eggs", "milk", "butter", "sugar", "baking powder", "salt", "vanilla", "maple syrup"]
        ),
        RecipeTemplate(
            id: "grilled-salmon",
            name: "Grilled Salmon",
            description: "Simple grilled salmon with vegetables",
            ingredients: ["salmon", "lemon", "garlic", "olive oil", "asparagus", "salt", "pepper", "butter", "dill"]
        )
    ]
}

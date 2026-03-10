import SwiftUI

/// Search for recipes online via the Spoonacular API.
struct OnlineRecipeSearchView: View {
    let userId: UUID
    let userEmail: String
    let collections: [RecipeCollection]
    let activeCollectionId: UUID?
    
    @State private var searchText = ""
    @State private var results: [SpoonacularSearchResult] = []
    @State private var isLoading = false
    @State private var hasSearched = false
    @State private var error: String?
    @State private var viewMode: ViewMode = .list
    @State private var searchTask: Task<Void, Never>?
    
    enum ViewMode: String, CaseIterable {
        case list = "List"
        case grid = "Grid"
    }
    
    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]
    
    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    loadingView
                } else if let errorMessage = error {
                    errorView(message: errorMessage)
                } else if hasSearched && results.isEmpty {
                    emptyResultsView
                } else if results.isEmpty {
                    initialStateView
                } else {
                    resultsList
                }
            }
            .navigationTitle("Search Online")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !results.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Picker("View", selection: $viewMode) {
                            ForEach(ViewMode.allCases, id: \.self) { mode in
                                Text(mode.rawValue).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 120)
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search recipes")
            .onChange(of: searchText) { _, newValue in
                searchTask?.cancel()
                guard !newValue.trimmingCharacters(in: .whitespaces).isEmpty else {
                    results = []
                    hasSearched = false
                    error = nil
                    return
                }
                searchTask = Task {
                    try? await Task.sleep(for: .milliseconds(300))
                    guard !Task.isCancelled else { return }
                    await performSearch(query: newValue)
                }
            }
        }
    }
    
    @ViewBuilder
    private var resultsList: some View {
        ScrollView {
            switch viewMode {
            case .list:
                LazyVStack(spacing: 0) {
                    ForEach(results) { recipe in
                        NavigationLink {
                            OnlineRecipePreviewView(
                                recipe: recipe,
                                userId: userId,
                                userEmail: userEmail,
                                collections: collections,
                                activeCollectionId: activeCollectionId
                            )
                        } label: {
                            listRow(recipe: recipe)
                        }
                        .buttonStyle(.plain)
                        Divider()
                            .padding(.leading, 72)
                    }
                }
            case .grid:
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(results) { recipe in
                        NavigationLink {
                            OnlineRecipePreviewView(
                                recipe: recipe,
                                userId: userId,
                                userEmail: userEmail,
                                collections: collections,
                                activeCollectionId: activeCollectionId
                            )
                        } label: {
                            gridCard(recipe: recipe)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
            attributionView
        }
    }
    
    @ViewBuilder
    private var attributionView: some View {
        HStack(spacing: 4) {
            Text("Powered by")
            Link("Spoonacular", destination: URL(string: "https://spoonacular.com")!)
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }
    
    @ViewBuilder
    private func listRow(recipe: SpoonacularSearchResult) -> some View {
        HStack(spacing: 12) {
            AsyncImage(url: URL(string: recipe.image)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure:
                    Image(systemName: "photo")
                        .foregroundStyle(.secondary)
                case .empty:
                    ProgressView()
                @unknown default:
                    Color.gray.opacity(0.2)
                }
            }
            .frame(width: 48, height: 48)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .background(Color(.systemGray5))
            .clipShape(RoundedRectangle(cornerRadius: 6))
            
            VStack(alignment: .leading, spacing: 4) {
                Text(recipe.title)
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(2)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                
                Text("\(recipe.readyInMinutes) min • \(recipe.servings) servings")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
    }
    
    @ViewBuilder
    private func gridCard(recipe: SpoonacularSearchResult) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: URL(string: recipe.image)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure:
                    Image(systemName: "photo")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color(.systemGray5))
                case .empty:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color(.systemGray5))
                @unknown default:
                    Color.gray.opacity(0.2)
                }
            }
            .frame(height: 120)
            .clipped()
            
            VStack(alignment: .leading, spacing: 4) {
                Text(recipe.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(2)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                
                Text("\(recipe.readyInMinutes) min • \(recipe.servings) servings")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(8)
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
    
    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Searching recipes...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
    
    @ViewBuilder
    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.orange)
            
            Text("Search unavailable")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            Button {
                Task {
                    await performSearch(query: searchText)
                }
            } label: {
                Label("Try Again", systemImage: "arrow.clockwise")
                    .fontWeight(.medium)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .padding()
    }
    
    private var emptyResultsView: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No recipes found")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("No recipes found for '\(searchText)'")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
    
    private var initialStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("Search for recipes")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Search for recipes to get started")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            attributionView
        }
        .padding()
    }
    
    private func performSearch(query: String) async {
        isLoading = true
        error = nil
        
        let searchResults = await RecipeSearchService.searchRecipes(query: query)
        
        guard !Task.isCancelled else { return }
        
        isLoading = false
        hasSearched = true
        
        if searchResults.isEmpty && !query.trimmingCharacters(in: .whitespaces).isEmpty {
            results = []
        } else {
            results = searchResults
        }
    }
}

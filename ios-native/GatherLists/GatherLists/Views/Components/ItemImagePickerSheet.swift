import SwiftUI
import PhotosUI

/// Sheet for selecting or uploading an image for a shopping list item.
struct ItemImagePickerSheet: View {
    let item: Item
    let userId: UUID
    let onImageUrlSet: (String) -> Void
    let onImageRemoved: () -> Void
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedTab = 0
    @State private var searchQuery: String
    @State private var searchResults: [ProductSearchResult] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    @State private var isUploading = false
    @State private var isRemoving = false
    @State private var errorMessage: String?
    @State private var showCamera = false
    @State private var selectedPhoto: PhotosPickerItem?
    
    init(
        item: Item,
        userId: UUID,
        onImageUrlSet: @escaping (String) -> Void,
        onImageRemoved: @escaping () -> Void
    ) {
        self.item = item
        self.userId = userId
        self.onImageUrlSet = onImageUrlSet
        self.onImageRemoved = onImageRemoved
        _searchQuery = State(initialValue: item.name)
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let imageUrl = item.imageUrl, !imageUrl.isEmpty {
                        existingImageSection(imageUrl: imageUrl)
                    }
                    
                    Picker("Tab", selection: $selectedTab) {
                        Text("Search online").tag(0)
                        Text("Upload").tag(1)
                    }
                    .pickerStyle(.segmented)
                    
                    if selectedTab == 0 {
                        searchTabContent
                    } else {
                        uploadTabContent
                    }
                    
                    if let error = errorMessage {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
                .padding()
            }
            .navigationTitle("Item Image")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { imageData in
                    handleImageData(imageData)
                }
            }
            .onChange(of: selectedPhoto) { _, newValue in
                guard let newValue else { return }
                Task {
                    if let data = try? await newValue.loadTransferable(type: Data.self) {
                        handleImageData(data)
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    private func existingImageSection(imageUrl: String) -> some View {
        VStack(spacing: 8) {
            AsyncImage(url: URL(string: imageUrl)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    Image(systemName: "photo")
                        .foregroundStyle(.secondary)
                case .empty:
                    ProgressView()
                @unknown default:
                    EmptyView()
                }
            }
            .frame(width: 120, height: 120)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            
            Button(role: .destructive) {
                removeImage()
            } label: {
                if isRemoving {
                    ProgressView()
                } else {
                    Text("Remove image")
                }
            }
            .disabled(isRemoving)
        }
    }
    
    @ViewBuilder
    private var searchTabContent: some View {
        VStack(spacing: 12) {
            HStack {
                TextField("Search...", text: $searchQuery)
                    .textFieldStyle(.roundedBorder)
                    .submitLabel(.search)
                    .onSubmit {
                        performSearch()
                    }
                
                Button("Search") {
                    performSearch()
                }
                .disabled(searchQuery.trimmingCharacters(in: .whitespaces).isEmpty || isSearching)
            }
            
            if isSearching {
                ProgressView("Searching...")
            } else if !searchResults.isEmpty {
                LazyVGrid(
                    columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ],
                    spacing: 8
                ) {
                    ForEach(searchResults, id: \.thumbnail) { result in
                        AsyncImage(url: URL(string: result.thumbnail)) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFill()
                            case .failure:
                                Image(systemName: "photo")
                                    .foregroundStyle(.secondary)
                            case .empty:
                                ProgressView()
                            @unknown default:
                                EmptyView()
                            }
                        }
                        .frame(width: 100, height: 100)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .onTapGesture {
                            selectSearchResult(result)
                        }
                    }
                }
            } else if hasSearched {
                Text("No images found")
                    .foregroundStyle(.secondary)
            }
        }
    }
    
    @ViewBuilder
    private var uploadTabContent: some View {
        if isUploading {
            ProgressView("Uploading...")
        } else {
            VStack(spacing: 12) {
                Button {
                    showCamera = true
                } label: {
                    Label("Take Photo", systemImage: "camera")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                
                PhotosPicker(
                    selection: $selectedPhoto,
                    matching: .images
                ) {
                    Label("Choose from Library", systemImage: "photo.on.rectangle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
    }
    
    private func performSearch() {
        guard !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        errorMessage = nil
        isSearching = true
        
        Task {
            let results = await ProductSearchService.searchProducts(query: searchQuery)
            searchResults = results
            hasSearched = true
            isSearching = false
        }
    }
    
    private func selectSearchResult(_ result: ProductSearchResult) {
        Task {
            do {
                try await ItemService.updateItem(itemId: item.id, imageUrl: result.thumbnail)
                onImageUrlSet(result.thumbnail)
                dismiss()
            } catch {
                errorMessage = "Failed to set image: \(error.localizedDescription)"
            }
        }
    }
    
    private func handleImageData(_ data: Data) {
        errorMessage = nil
        isUploading = true
        
        Task {
            do {
                let publicUrl = try await StorageService.uploadItemImage(
                    userId: userId,
                    itemId: item.id,
                    imageData: data
                )
                onImageUrlSet(publicUrl)
                dismiss()
            } catch {
                errorMessage = "Failed to upload image: \(error.localizedDescription)"
                isUploading = false
            }
        }
    }
    
    private func removeImage() {
        errorMessage = nil
        isRemoving = true
        
        Task {
            do {
                try await StorageService.deleteItemImage(userId: userId, itemId: item.id)
                onImageRemoved()
                dismiss()
            } catch {
                errorMessage = "Failed to remove image: \(error.localizedDescription)"
                isRemoving = false
            }
        }
    }
}

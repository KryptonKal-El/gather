import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// Sheet for selecting or uploading an image for a shopping list item.
/// When an image exists, shows view-only mode with large preview and remove button.
/// When no image or after removal, shows full picker with search/upload tabs.
struct ItemImagePickerSheet: View {
    let item: Item
    let userId: UUID
    let imageSearchSettings: ImageSearchSettings
    let onImageUrlSet: (String) -> Void
    let onImageRemoved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var authViewModel
    
    @State private var viewMode: Bool
    @State private var selectedTab = 0
    @State private var searchQuery: String
    @State private var searchSections: [ImageSearchSource: SearchSectionState] = [:]
    /// Bumped on every new search so late responses from an older query are ignored.
    @State private var searchGeneration = 0
    @State private var searchedQuery = ""
    @State private var collapsedSources: Set<ImageSearchSource> = []
    @State private var isUploading = false
    @State private var isRemoving = false
    @State private var errorMessage: String?
    @State private var showCamera = false
    @State private var selectedPhoto: PhotosPickerItem?
    /// A just-obtained local image awaiting the crop step before upload.
    @State private var imageToCrop: CropCandidate?
    @State private var shouldTriggerSearch = false
    @State private var pinchStartColumns: Int?
    @AppStorage("imageSearchGridColumns") private var gridColumns = 3

    private static let gridColumnRange = 1...5

    init(
        item: Item,
        userId: UUID,
        imageSearchSettings: ImageSearchSettings = .defaultSettings,
        onImageUrlSet: @escaping (String) -> Void,
        onImageRemoved: @escaping () -> Void
    ) {
        self.item = item
        self.userId = userId
        self.imageSearchSettings = imageSearchSettings
        self.onImageUrlSet = onImageUrlSet
        self.onImageRemoved = onImageRemoved
        _searchQuery = State(initialValue: item.name)
        _viewMode = State(initialValue: item.imageUrl != nil && !item.imageUrl!.isEmpty)
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if viewMode, let imageUrl = item.imageUrl, !imageUrl.isEmpty {
                        viewOnlyContent(imageUrl: imageUrl)
                    } else {
                        pickerContent
                    }
                    
                    if let error = errorMessage {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.quicksand(.caption))
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
                    presentCropper(for: imageData)
                }
            }
            .fullScreenCover(item: $imageToCrop) { candidate in
                ImageCropView(
                    image: candidate.image,
                    onCrop: { cropped in
                        imageToCrop = nil
                        if let data = cropped.jpegData(compressionQuality: 0.9) {
                            handleImageData(data)
                        }
                    },
                    onCancel: { imageToCrop = nil }
                )
            }
            .onChange(of: selectedPhoto) { _, newValue in
                guard let newValue else { return }
                Task {
                    if let data = try? await newValue.loadTransferable(type: Data.self) {
                        presentCropper(for: data)
                    }
                }
            }
            .task {
                if !viewMode && !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty {
                    performSearch()
                }
            }
            .onChange(of: shouldTriggerSearch) { _, newValue in
                if newValue {
                    shouldTriggerSearch = false
                    performSearch()
                }
            }
        }
    }
    
    @ViewBuilder
    private func viewOnlyContent(imageUrl: String) -> some View {
        VStack(spacing: 16) {
            AsyncImage(url: URL(string: imageUrl)) { phase in
                switch phase {
                case .success(let image):
                    ZoomableContainer {
                        image
                            .resizable()
                            .scaledToFit()
                    }
                case .failure:
                    Image(systemName: "photo")
                        .font(.quicksand(size: 60))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 300)
                        .background(Color(.systemGray6))
                case .empty:
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .frame(height: 300)
                @unknown default:
                    EmptyView()
                }
            }
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            
            Button(role: .destructive) {
                removeImage()
            } label: {
                if isRemoving {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Remove image")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.bordered)
            .disabled(isRemoving)
        }
    }
    
    @ViewBuilder
    private var pickerContent: some View {
        VStack(spacing: 16) {
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
        }
    }
    
    private var enabledSources: [ImageSearchSource] {
        ImageSearchSource.enabled(in: imageSearchSettings)
    }

    private var isSearching: Bool {
        searchSections.values.contains { state in
            if case .loading = state { return true }
            return false
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
            
            if enabledSources.isEmpty {
                VStack(spacing: 12) {
                    Text("No image search sources enabled.")
                        .foregroundStyle(.secondary)
                    NavigationLink("Open Settings") {
                        SettingsView()
                            .environment(authViewModel)
                    }
                }
            } else if !searchSections.isEmpty {
                VStack(spacing: 16) {
                    ForEach(enabledSources) { source in
                        if let state = searchSections[source] {
                            searchSection(source, state: state)
                        }
                    }
                }
                .simultaneousGesture(gridPinchGesture)
                .sensoryFeedback(.selection, trigger: gridColumns)
            }
        }
    }

    /// One source's collapsible header plus its own loading, error, empty, or results state.
    @ViewBuilder
    private func searchSection(_ source: ImageSearchSource, state: SearchSectionState) -> some View {
        let isCollapsed = collapsedSources.contains(source)
        VStack(alignment: .leading, spacing: 8) {
            searchSectionHeader(source, state: state, isCollapsed: isCollapsed)
            if !isCollapsed {
                searchSectionBody(source, state: state)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func searchSectionHeader(_ source: ImageSearchSource, state: SearchSectionState, isCollapsed: Bool) -> some View {
        Button {
            withAnimation(.snappy) {
                if isCollapsed {
                    collapsedSources.remove(source)
                } else {
                    collapsedSources.insert(source)
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .rotationEffect(.degrees(isCollapsed ? 0 : 90))
                Text(source.label)
                    .font(.quicksand(.subheadline, weight: .semibold))
                    .foregroundStyle(.primary)
                Spacer()
                searchSectionBadge(state)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
            .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(source.label)
        .accessibilityValue(isCollapsed ? "Collapsed" : "Expanded")
    }

    /// Trailing status in a section header, so a collapsed section still shows what it holds.
    @ViewBuilder
    private func searchSectionBadge(_ state: SearchSectionState) -> some View {
        switch state {
        case .loading:
            ProgressView()
                .controlSize(.small)
        case .failed:
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.footnote)
                .foregroundStyle(.orange)
                .accessibilityLabel("Couldn't load")
        case .loaded(let results):
            Text("\(results.count)")
                .font(.quicksand(.caption, weight: .semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Color(.tertiarySystemFill), in: Capsule())
                .accessibilityLabel("\(results.count) results")
        }
    }

    @ViewBuilder
    private func searchSectionBody(_ source: ImageSearchSource, state: SearchSectionState) -> some View {
        switch state {
        case .loading:
            Text("Searching \(source.label)...")
                .font(.quicksand(.footnote))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)
        case .failed:
            HStack(spacing: 8) {
                Text("Couldn't load results.")
                    .font(.quicksand(.footnote))
                    .foregroundStyle(.secondary)
                Button("Retry") {
                    loadSource(source, query: searchedQuery, generation: searchGeneration)
                }
                .font(.quicksand(.footnote))
                .accessibilityLabel("Retry \(source.label)")
            }
            .padding(.horizontal, 12)
        case .loaded(let results) where results.isEmpty:
            Text("No results")
                .font(.quicksand(.footnote))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)
        case .loaded(let results):
            searchResultsGrid(results)
        }
    }

    private func searchResultsGrid(_ results: [ProductResult]) -> some View {
        LazyVGrid(
            columns: Array(
                repeating: GridItem(.flexible(), spacing: 8),
                count: gridColumns
            ),
            spacing: 8
        ) {
            ForEach(results, id: \.url) { result in
                ZStack {
                    Color(.systemGray6)
                    AsyncImage(url: URL(string: result.url)) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFit()
                        case .failure:
                            Image(systemName: "photo")
                                .foregroundStyle(.secondary)
                        case .empty:
                            ProgressView()
                        @unknown default:
                            EmptyView()
                        }
                    }
                    .padding(3)
                }
                .aspectRatio(1, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .onTapGesture {
                    selectSearchResult(result)
                }
            }
        }
    }
    
    /// Photos-style resize: pinching out shows fewer, larger thumbnails; pinching in shows more, smaller ones.
    private var gridPinchGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let startColumns = pinchStartColumns ?? gridColumns
                pinchStartColumns = startColumns
                let ideal = Double(startColumns) / value.magnification
                // Hysteresis so the grid doesn't flicker between two counts near a boundary.
                guard abs(ideal - Double(gridColumns)) >= 0.65 else { return }
                let target = min(max(Int(ideal.rounded()), Self.gridColumnRange.lowerBound), Self.gridColumnRange.upperBound)
                guard target != gridColumns else { return }
                withAnimation(.snappy) {
                    gridColumns = target
                }
            }
            .onEnded { _ in
                pinchStartColumns = nil
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

                // Paste an image straight from the clipboard. PasteButton auto-disables
                // when the clipboard holds no image and needs no paste permission prompt.
                PasteButton(supportedContentTypes: [.image]) { providers in
                    guard let provider = providers.first else { return }
                    loadPastedImage(from: provider)
                }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
            }
        }
    }
    
    private func performSearch() {
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return }
        errorMessage = nil
        searchGeneration += 1
        searchedQuery = query
        searchSections = [:]
        for source in enabledSources {
            loadSource(source, query: query, generation: searchGeneration)
        }
    }

    /// Loads one source's section; used for both the initial search and a per-section retry.
    private func loadSource(_ source: ImageSearchSource, query: String, generation: Int) {
        searchSections[source] = .loading
        Task {
            let state: SearchSectionState
            do {
                state = .loaded(try await ProductSearchService.search(query: query, source: source))
            } catch {
                print("[ItemImagePickerSheet] \(source.rawValue) search failed for '\(query)': \(error)")
                state = .failed
            }
            guard generation == searchGeneration else { return }
            searchSections[source] = state
        }
    }
    
    private func selectSearchResult(_ result: ProductResult) {
        Task {
            do {
                try await ItemService.updateItem(itemId: item.id, imageUrl: result.url)
                onImageUrlSet(result.url)
                dismiss()
            } catch {
                errorMessage = "Failed to set image: \(error.localizedDescription)"
            }
        }
    }
    
    /// Loads a pasted image from the provider. It reads the concrete image
    /// type's raw data and decodes it with `UIImage(data:)`, which handles
    /// formats such as WebP that `UIImage`'s NSItemProvider reader doesn't list
    /// (so `loadObject(ofClass: UIImage.self)` would silently fail on them).
    private func loadPastedImage(from provider: NSItemProvider) {
        if let imageType = provider.registeredContentTypes(conformingTo: .image).first {
            provider.loadDataRepresentation(for: imageType) { data, _ in
                guard let data, let image = UIImage(data: data) else { return }
                Task { @MainActor in imageToCrop = CropCandidate(image: image) }
            }
        } else if provider.canLoadObject(ofClass: UIImage.self) {
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                guard let image = object as? UIImage else { return }
                Task { @MainActor in imageToCrop = CropCandidate(image: image) }
            }
        }
    }

    /// Shows the crop step for a just-obtained image. Decodes the raw data; if that fails it
    /// uploads the data as-is so the user is never stuck. Deferred to the next runloop so a
    /// presenting camera cover finishes dismissing before the crop cover appears.
    private func presentCropper(for data: Data) {
        guard let image = UIImage(data: data) else {
            handleImageData(data)
            return
        }
        DispatchQueue.main.async { imageToCrop = CropCandidate(image: image) }
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
                viewMode = false
                selectedTab = 0
                isRemoving = false
                shouldTriggerSearch = true
            } catch {
                errorMessage = "Failed to remove image: \(error.localizedDescription)"
                isRemoving = false
            }
        }
    }
}

/// Load state of one image search source's section.
private enum SearchSectionState {
    case loading
    case loaded([ProductResult])
    case failed
}

/// A local image awaiting the crop step, wrapped for `fullScreenCover(item:)`.
private struct CropCandidate: Identifiable {
    let id = UUID()
    let image: UIImage
}

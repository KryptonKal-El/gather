import SwiftUI
import PhotosUI
import Supabase
import Auth

struct SettingsView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    
    @State private var isUploading = false
    @State private var uploadError: String?
    @State private var showPhotoSourceSheet = false
    @State private var showCamera = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var photoPickerPresented = false
    @State private var showNameAlert = false
    @State private var editedName = ""
    @State private var isSavingName = false
    @State private var appearanceSetting = AppearanceManager.shared.setting
    @State private var activeSortConfig: [SortLevel] = SortPipeline.systemDefault
    @State private var showSortConfigSheet = false
    @State private var isLoadingPreferences = true
    
    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 12) {
                        avatarView
                            .onTapGesture {
                                showPhotoSourceSheet = true
                            }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(authViewModel.displayName)
                                .font(.headline)
                            if let email = authViewModel.email {
                                Text(email)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    
                    if let error = uploadError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    
                    Button {
                        editedName = authViewModel.displayName
                        showNameAlert = true
                    } label: {
                        HStack {
                            Text("Display Name")
                            Spacer()
                            Text(authViewModel.displayName)
                                .foregroundStyle(.secondary)
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .foregroundStyle(.primary)
                }
                
                Section("Appearance") {
                    Picker("Appearance", selection: $appearanceSetting) {
                        ForEach(AppearanceManager.AppearanceSetting.allCases, id: \.self) { option in
                            Text(option.displayName).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: appearanceSetting) { _, newValue in
                        AppearanceManager.shared.setting = newValue
                    }
                }
                
                Section("Display") {
                    if isLoadingPreferences {
                        ProgressView()
                    } else {
                        Button {
                            showSortConfigSheet = true
                        } label: {
                            HStack {
                                Text("Default Sort")
                                    .foregroundStyle(.primary)
                                Spacer()
                                Text(activeSortConfig.map { levelLabel($0) }.joined(separator: " → "))
                                    .foregroundStyle(.secondary)
                                    .font(.subheadline)
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    }
                }
                
                Section {
                    Button(role: .destructive) {
                        Task {
                            await authViewModel.signOut()
                        }
                    } label: {
                        HStack {
                            Spacer()
                            Text("Sign Out")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Change Profile Photo", isPresented: $showPhotoSourceSheet) {
                Button("Take Photo") {
                    showCamera = true
                }
                Button("Choose from Library") {
                    photoPickerPresented = true
                }
                Button("Cancel", role: .cancel) {}
            }
            .sheet(isPresented: $showCamera) {
                CameraPicker { imageData in
                    Task {
                        await uploadAvatar(imageData: imageData)
                    }
                }
            }
            .photosPicker(isPresented: $photoPickerPresented, selection: $selectedPhoto, matching: .images)
            .onChange(of: selectedPhoto) { _, newItem in
                guard let newItem else { return }
                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self) {
                        await uploadAvatar(imageData: data)
                    }
                }
            }
            .alert("Edit Display Name", isPresented: $showNameAlert) {
                TextField("Display Name", text: $editedName)
                Button("Cancel", role: .cancel) {}
                Button("Save") {
                    Task { await saveDisplayName() }
                }
            } message: {
                Text("Enter your display name")
            }
            .sheet(isPresented: $showSortConfigSheet) {
                SortConfigSheet(
                    activeSortConfig: $activeSortConfig,
                    hasOverride: false,
                    onConfigChange: { config in
                        if let config = config {
                            try? await PreferenceService.updateDefaultSortConfig(config)
                        }
                    }
                )
            }
            .task {
                do {
                    let prefs = try await PreferenceService.fetchUserPreferences()
                    let levels = prefs.defaultSortConfig.compactMap { SortLevel(rawValue: $0) }
                    if !levels.isEmpty {
                        activeSortConfig = levels
                    }
                } catch {
                    print("[SettingsView] Failed to load preferences: \(error.localizedDescription)")
                }
                isLoadingPreferences = false
            }
        }
    }
    
    @ViewBuilder
    private var avatarView: some View {
        ZStack {
            if let avatarUrl = authViewModel.avatarUrl, let url = URL(string: avatarUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    firstLetterCircle
                }
                .frame(width: 56, height: 56)
                .clipShape(Circle())
            } else {
                firstLetterCircle
            }
            
            if isUploading {
                Circle()
                    .fill(.black.opacity(0.4))
                    .frame(width: 56, height: 56)
                ProgressView()
                    .tint(.white)
            }
        }
    }
    
    private var firstLetterCircle: some View {
        Circle()
            .fill(Color.green)
            .frame(width: 56, height: 56)
            .overlay(
                Text(String(authViewModel.displayName.prefix(1)).uppercased())
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
            )
    }
    
    private func levelLabel(_ level: SortLevel) -> String {
        switch level {
        case .store: return "Store"
        case .category: return "Category"
        case .name: return "Name"
        case .date: return "Date"
        }
    }
    
    private func uploadAvatar(imageData: Data) async {
        guard let userId = authViewModel.currentUser?.id else { return }
        isUploading = true
        uploadError = nil
        do {
            _ = try await StorageService.uploadProfileImage(userId: userId, imageData: imageData)
            await authViewModel.refreshProfile()
        } catch {
            uploadError = error.localizedDescription
        }
        isUploading = false
    }
    
    private func saveDisplayName() async {
        let trimmed = editedName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let userId = authViewModel.currentUser?.id else { return }
        isSavingName = true
        do {
            try await ProfileService.updateDisplayName(userId: userId, name: trimmed)
            try await SupabaseManager.shared.client.auth.update(
                user: UserAttributes(data: ["full_name": .string(trimmed)])
            )
            await authViewModel.refreshProfile()
        } catch {
            print("[SettingsView] Failed to update display name: \(error.localizedDescription)")
        }
        isSavingName = false
    }
}

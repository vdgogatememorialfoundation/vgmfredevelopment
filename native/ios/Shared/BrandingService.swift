import UIKit

struct AppBrand {
    var name: String
    var logo: UIImage?
}

enum Flavor {
    static var id: String {
        (Bundle.main.object(forInfoDictionaryKey: "VGMF_FLAVOR") as? String)?.lowercased() ?? "customer"
    }

    static var fallbackName: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
            ?? Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String
            ?? "VGMF"
    }

    static var tabs: [(id: String, title: String, system: String)] {
        switch id {
        case "admin":
            return [("home", "Desk", "square.grid.2x2.fill"), ("events", "Events", "calendar"), ("shop", "Shop", "books.vertical.fill"), ("support", "Tickets", "lifepreserver.fill"), ("account", "Account", "person.crop.circle")]
        case "staff":
            return [("home", "Home", "house.fill"), ("events", "Events", "calendar"), ("notices", "Notices", "megaphone.fill"), ("support", "Tickets", "lifepreserver.fill"), ("account", "Account", "person.crop.circle")]
        case "support":
            return [("home", "Home", "house.fill"), ("support", "Tickets", "lifepreserver.fill"), ("certificates", "Certificates", "checkmark.seal.fill"), ("account", "Account", "person.crop.circle")]
        default:
            return [("home", "Home", "house.fill"), ("events", "Events", "calendar"), ("shop", "Shop", "books.vertical.fill"), ("clinics", "Clinics", "cross.case.fill"), ("account", "Account", "person.crop.circle")]
        }
    }
}

enum FeedClient {
    static let origin = "https://vaidyagogate.org"
    static var base = origin
    static var token: String?
    static var email = ""
    static var name = ""

    static func text(_ value: Any?, _ fallback: String = "") -> String {
        guard let value else { return fallback }
        let text = String(describing: value).trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? fallback : text
    }

    static func loadFeed() async throws -> [String: Any] {
        let urls = [
            "\(base)/api/mobile/feed?t=\(Int(Date().timeIntervalSince1970))",
            "\(origin)/app-feed.json",
        ]
        var last = "Feed missing"
        for raw in urls {
            guard let url = URL(string: raw) else { continue }
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                let decoded = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
                let feed = (decoded["feed"] as? [String: Any]) ?? decoded
                if feed["site"] is [String: Any] {
                    if let mobile = feed["mobile"] as? [String: Any], let api = mobile["apiBaseUrl"] as? String, api.hasPrefix("http") {
                        base = api.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                    }
                    return feed
                }
                last = "Feed missing"
            } catch {
                last = error.localizedDescription
            }
        }
        throw NSError(domain: "VGMF", code: 1, userInfo: [NSLocalizedDescriptionKey: last])
    }

    static func image(from value: String?) -> UIImage? {
        guard let value, !value.isEmpty else { return nil }
        if value.hasPrefix("data:image"), let comma = value.firstIndex(of: ",") {
            let encoded = String(value[value.index(after: comma)...])
            if let data = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters) {
                return UIImage(data: data)
            }
        }
        return nil
    }

    static func brand(from feed: [String: Any]) -> AppBrand {
        let apps = ((feed["mobile"] as? [String: Any])?["apps"] as? [String: Any]) ?? [:]
        let brand = apps[Flavor.id] as? [String: Any] ?? [:]
        let site = feed["site"] as? [String: Any] ?? [:]
        let name = text(brand["name"]).isEmpty ? text(site["name"], Flavor.fallbackName) : text(brand["name"])
        let logoValue = text(brand["logoUrl"]).isEmpty ? text(site["logoUrl"]) : text(brand["logoUrl"])
        return AppBrand(name: name, logo: image(from: logoValue))
    }

    static func loadLogo(_ value: String?) async -> UIImage? {
        if let dataUri = image(from: value) { return dataUri }
        guard let value, !value.isEmpty else { return nil }
        let raw = value.hasPrefix("http") ? value : "\(origin)\(value)"
        guard let url = URL(string: raw) else { return nil }
        let (data, _) = try? await URLSession.shared.data(from: url)
        return data.flatMap(UIImage.init(data:))
    }

    private static var headers: [String: String] {
        var value = ["accept": "application/json", "content-type": "application/json"]
        if let token { value["authorization"] = "Bearer \(token)" }
        return value
    }

    static func post(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: "\(base)\(path)") else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: request)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    static func get(_ path: String) async throws -> [String: Any] {
        guard let url = URL(string: "\(base)\(path)") else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
        let (data, _) = try await URLSession.shared.data(for: request)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
}

enum BrandingService {
    static var origin: String { FeedClient.origin }
    static var flavor: String { Flavor.id }
    static var fallbackName: String { Flavor.fallbackName }
    static var startPath: String { "/" }
    static var startURL: URL? { URL(string: origin) }

    static func load(completion: @escaping (AppBrand) -> Void) {
        Task {
            let feed = try? await FeedClient.loadFeed()
            let brand = FeedClient.brand(from: feed ?? [:])
            await MainActor.run { completion(brand) }
        }
    }
}

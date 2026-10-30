import UIKit

struct AppBrand {
    var name: String
    var logo: UIImage?
}

enum BrandingService {
    static let origin = "https://vaidyagogate.org"

    static var flavor: String {
        (Bundle.main.object(forInfoDictionaryKey: "VGMF_FLAVOR") as? String)?.lowercased() ?? "customer"
    }

    static var startPath: String {
        Bundle.main.object(forInfoDictionaryKey: "START_PATH") as? String ?? "/"
    }

    static var fallbackName: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
            ?? Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String
            ?? "VGMF"
    }

    static var startURL: URL? {
        URL(string: origin.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + startPath)
    }

    static func load(completion: @escaping (AppBrand) -> Void) {
        guard let url = URL(string: "\(origin)/api/mobile/feed?t=\(Int(Date().timeIntervalSince1970))") else { return }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return }
            let feed = (json["feed"] as? [String: Any]) ?? json
            let apps = ((feed["mobile"] as? [String: Any])?["apps"] as? [String: Any]) ?? [:]
            let brand = apps[flavor] as? [String: Any] ?? [:]
            let site = feed["site"] as? [String: Any] ?? [:]
            let name = trimmed(brand["name"] as? String) ?? trimmed(site["name"] as? String) ?? fallbackName
            let logoValue = trimmed(brand["logoUrl"] as? String) ?? trimmed(site["logoUrl"] as? String)
            loadLogo(logoValue) { image in
                DispatchQueue.main.async {
                    completion(AppBrand(name: name, logo: image))
                }
            }
        }.resume()
    }

    private static func trimmed(_ value: String?) -> String? {
        let text = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return text.isEmpty ? nil : text
    }

    private static func loadLogo(_ value: String?, completion: @escaping (UIImage?) -> Void) {
        guard let value else { return completion(nil) }
        if value.hasPrefix("data:image"), let comma = value.firstIndex(of: ",") {
            let encoded = String(value[value.index(after: comma)...])
            if let data = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters) {
                completion(UIImage(data: data))
                return
            }
        }
        let url = value.hasPrefix("http") ? URL(string: value) : URL(string: origin + value)
        guard let url else { return completion(nil) }
        URLSession.shared.dataTask(with: url) { data, _, _ in
            completion(data.flatMap(UIImage.init(data:)))
        }.resume()
    }
}

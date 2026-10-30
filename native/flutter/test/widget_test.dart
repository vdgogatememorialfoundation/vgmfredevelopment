import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:vgmf/flavor.dart";

void main() {
  test("flavors expose native tabs and names", () {
    final current = Flavor.current();
    expect(current.id, isNotEmpty);
    expect(current.tabs, isNotEmpty);
    expect(current.displayName, isNotEmpty);
    const admin = Flavor(
      id: "admin",
      displayName: "VGMF Admin",
      accent: Color(0xFF6A1F1F),
      tabs: [],
    );
    expect(admin.displayName, "VGMF Admin");
  });
}

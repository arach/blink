cask "blink" do
  version "@@VERSION@@"
  sha256 "@@DMG_SHA256@@"

  url "https://github.com/@@REPO@@/releases/download/v#{version}/Blink.dmg"
  name "Blink"
  desc "Spatial note-taking with floating panels"
  homepage "https://blink.arach.dev/"

  depends_on arch: :arm64
  depends_on macos: :sonoma

  app "Blink.app"

  uninstall quit: "dev.arach.blink"
end

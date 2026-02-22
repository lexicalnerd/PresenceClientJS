
# PresenceClientJS
Custom client for [SwitchPresence-Rewritten](https://github.com/HeadpatServices/SwitchPresence-Rewritten) which adds support for dynamically changing `LargeImageKey` for the Rich Presence.

![Playing](https://raw.githubusercontent.com/lexicalnerd/PresenceClientJS/refs/heads/main/playing.png)
![Watching](https://raw.githubusercontent.com/lexicalnerd/PresenceClientJS/refs/heads/main/watching.png)

## Install

### Preparing
* **Installing SwitchPresence-Rewritten requires a Switch running Atmosphere custom firmware.**
* General homebrew installing information can be found [here](https://switch.hacks.guide/)

### Steps
1. Download the latest release of SwitchClient-Rewritten from [here](https://github.com/HeadpatServices/SwitchPresence-Rewritten/releases)
2. Drag the `atmosphere` folder onto the root of your SD Card, drag `SwitchPresence-Rewritten-Manager.nro` into the `switch` folder on your SD Card
3. Clone this repository, open a terminal inside it and run `yarn`. If you don't have yarn installed, run `npm i` instead.
4. Edit `config.json` with your favourite text editor and change `SWITCH_IP` to your Nintendo Switch's IP address.
5. Run `yarn start` or `npm run` if yarn isn't installed.
6. You're all set!

## Missing Game Icons
If you've found a game or Homebrew that does not have a icon on Discord, file a new [issue](https://github.com/lexicalnerd/PresenceClientJS/issues/new) or pull request on the `Client.ts`.

## Credits 
- **Original client:** [DelxHQ/PresenceClientJS](https://github.com/DelxHQ/PresenceClientJS/)
- **SwitchPresence-Rewritten:** ([HeadpatServices/SwitchPresence-Rewritten](https://github.com/HeadpatServices/SwitchPresence-Rewritten)

# Overlayz - Hedera NFT Overlay Tool

Overlayz is a dApp for Hedera that allows users to apply overlays and accessories to their NFTs. It's designed to work within the HashPack wallet app and uses the Hedera Mirror Node API to fetch NFT data.

## How It Works

1. **Connect Wallet**: Connect your HashPack wallet to access your NFTs.
2. **Select NFT**: View your collection and select an NFT to modify.
3. **Apply Overlays**: Choose from various overlays.
4. **Customize**: Move, rotate and resize the overlays to perfect the look.
5. **Save**: Download the modified NFT image.

## Setup

1. **Clone the repository**
   ```
   git clone https://github.com/HeftySammich/Overlayz
   ```

2. **Install dependencies**
   ```
   npm install
   ```

3. **Add overlay images**
   - Place your overlay images in the appropriate folders:
     - `/assets/arts/`
     - `/assets/fonts`
     - `/assets/icon/`
    
4. **Configure for your project**
   - Replace 'const projectId' in main.js with your own Hedera Project ID
   - Replace 'const metadata' in main.js with your project details
   - Replace contents of style.css and index.html with your details
  
5. **Start the development server**
   ```
   npm run dev
   ```

6. **Build for production**
   ```
   npm run build
   ```

## Technical Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Wallet Integration**: HashPack via HashConnect
- **Blockchain**: Hedera (HBAR)
- **API**: Hedera Mirror Node
- **Image Manipulation**: Konva

## Features

- HashPack wallet integration
- Wallet Connect integration
- Built for HashPack's dApp browser 

## Credits

- Built by SLIME
- Created for the Hedera community
- Shout out to Spagħettaaay.ħbar whose initial idea brought this to life

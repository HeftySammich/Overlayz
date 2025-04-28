import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { LedgerId } from '@hashgraph/sdk';

let dAppConnector;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');

  // Initialize WalletConnect
  async function initializeWalletConnect() {
    console.log('Starting WalletConnect initialization');
    try {
      const projectId = '19f08313224ac846097e6a722ab078fc';
      const metadata = {
        name: 'Overlayz',
        description: 'NFT Overlay Tool for Hedera',
        url: 'https://hederanftoverlayz.vercel.app',
        icons: ['/assets/icon/Overlayz_App_Icon.png'],
      };

      console.log('Creating DAppConnector instance');
      dAppConnector = new DAppConnector(
        metadata,
        LedgerId.MAINNET,
        projectId,
        ['hedera_getAccountBalance', 'hedera_sign', 'hedera_signTransaction'],
        ['chainChanged', 'accountsChanged'],
        ['hedera:mainnet']
      );

      console.log('Initializing DAppConnector');
      await dAppConnector.init({ logger: 'error' });
      console.log('WalletConnect initialized successfully');

      // Connect on button click
      console.log('Setting up connect-wallet button listener');
      const connectButton = document.getElementById('connect-wallet');
      if (connectButton) {
        console.log('connect-wallet button found');
        connectButton.addEventListener('click', async () => {
          console.log('Connect button clicked');
          try {
            const session = await dAppConnector.openModal();
            console.log('Session established:', session);
            handleNewSession(session);
          } catch (error) {
            console.error('Connection error:', error);
            const walletStatus = document.getElementById('wallet-status');
            if (walletStatus) walletStatus.textContent = 'Connection failed';
          }
        });
      } else {
        console.error('connect-wallet button not found');
      }

      // Disconnect
      console.log('Setting up disconnect-wallet button listener');
      const disconnectButton = document.getElementById('disconnect-wallet');
      if (disconnectButton) {
        console.log('disconnect-wallet button found');
        disconnectButton.addEventListener('click', disconnectWallet);
      } else {
        console.error('disconnect-wallet button not found');
      }

      // Overlay upload
      console.log('Setting up overlay-upload listener');
      const overlayUpload = document.getElementById('overlay-upload');
      if (overlayUpload) {
        overlayUpload.addEventListener('change', (event) => {
          const file = event.target.files[0];
          if (file) {
            const overlayImg = document.getElementById('overlay-img');
            overlayImg.src = URL.createObjectURL(file);
            drawCanvas();
          }
        });
      }

      // Preset overlays
      console.log('Setting up overlay buttons');
      ['overlay1', 'overlay2', 'overlay3', 'overlay4', 'overlay5', 'overlay6', 'overlay7'].forEach((id, index) => {
        const button = document.getElementById(id);
        if (button) {
          button.addEventListener('click', () => {
            const overlayImg = document.getElementById('overlay-img');
            const overlays = [
              '/assets/arts/Good_Morning._Overlay.png', // overlay1: Good Morning
              '/assets/arts/Mic.Overlay.png',          // overlay2: Microphone
              '/assets/arts/Boombox.Overlay.png',      // overlay3: Boombox
              '/assets/arts/Bonjour.Overlay.png',      // overlay4: Bonjour
              '/assets/arts/Sign.Overlay.png',         // overlay5: Sign
              '/assets/arts/Goodnight.Overlay.png',    // overlay6: Goodnight
              ''                                       // overlay7: Upload Image (handled separately)
            ];
            // Only set overlayImg.src for buttons overlay1 to overlay6
            if (index < 6) {
              overlayImg.src = overlays[index];
              console.log(`Overlay button ${id} clicked, setting overlay to ${overlays[index]}`);
              drawCanvas();
            }
          });
        } else {
          console.error(`Overlay button with ID ${id} not found`);
        }
      });

      // Canvas setup
      console.log('Setting up canvas listeners');
      const canvas = document.getElementById('nft-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        let isDragging = false;
        let overlayX = 0, overlayY = 0;
        let overlayWidth = 0, overlayHeight = 0; // Will be set based on NFT size
        let scaleFactor = 0.3; // Initial overlay size: 30% of NFT size

        canvas.addEventListener('mousedown', (e) => {
          isDragging = true;
          updateOverlayPosition(e);
        });
        canvas.addEventListener('mousemove', (e) => {
          if (isDragging) updateOverlayPosition(e);
        });
        canvas.addEventListener('mouseup', () => { isDragging = false; });
        canvas.addEventListener('mouseout', () => { isDragging = false; });
        // Add mouse wheel listener for resizing
        canvas.addEventListener('wheel', (e) => {
          e.preventDefault();
          scaleFactor += e.deltaY > 0 ? -0.02 : 0.02; // Scroll down to shrink, up to grow
          scaleFactor = Math.max(0.1, Math.min(scaleFactor, 1)); // Limit scale between 10% and 100%
          console.log(`Overlay scale factor adjusted to: ${scaleFactor}`);
          drawCanvas();
        });

        window.drawCanvas = function () {
          if (!selectedNFT) {
            console.log('No NFT selected for canvas');
            return;
          }
          const nftImg = new Image();
          const overlayImg = document.getElementById('overlay-img');
          nftImg.src = selectedNFT;
          nftImg.crossOrigin = 'Anonymous'; // Handle CORS if needed
          nftImg.onload = () => {
            canvas.width = nftImg.width;
            canvas.height = nftImg.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(nftImg, 0, 0);
            if (overlayImg.src) {
              const overlay = new Image();
              overlay.crossOrigin = 'Anonymous'; // Handle CORS if needed
              overlay.src = overlayImg.src;
              overlay.onload = () => {
                // Scale overlay relative to NFT size
                overlayWidth = nftImg.width * scaleFactor;
                overlayHeight = nftImg.height * scaleFactor;
                console.log('Overlay image loaded, drawing on canvas');
                ctx.drawImage(overlay, overlayX, overlayY, overlayWidth, overlayHeight);
              };
              overlay.onerror = () => {
                console.error('Failed to load overlay image:', overlay.src);
              };
            } else {
              console.log('No overlay image selected');
            }
          };
          nftImg.onerror = () => {
            console.error('Failed to load NFT image:', nftImg.src);
          };
        };

        window.updateOverlayPosition = function (e) {
          const rect = canvas.getBoundingClientRect();
          overlayX = e.clientX - rect.left - overlayWidth / 2;
          overlayY = e.clientY - rect.top - overlayHeight / 2;
          drawCanvas();
        };
      }

      // Apply overlay
      console.log('Setting up apply-overlay listener');
      const applyButton = document.getElementById('apply-overlay');
      if (applyButton) {
        applyButton.addEventListener('click', () => {
          if (selectedNFT) {
            const link = document.createElement('a');
            link.href = canvas.toDataURL();
            link.download = 'overlayed-nft.png';
            link.click();
          } else {
            alert('Select an NFT first!');
          }
        });
      }
    } catch (error) {
      console.error('Wallet init error:', error);
    }
  }

  // Handle new session
  function handleNewSession(session) {
    console.log('Handling new session');
    const account = session.namespaces?.hedera?.accounts?.[0];
    if (!account) {
      console.error('No account found');
      return;
    }

    const accountId = account.split(':').pop();
    localStorage.setItem('hederaAccountId', accountId);
    const walletStatus = document.getElementById('wallet-status');
    if (walletStatus) {
      walletStatus.textContent = `Connected: ${accountId}`;
    } else {
      console.error('wallet-status element not found');
    }
    const connectButton = document.getElementById('connect-wallet');
    const disconnectButton = document.getElementById('disconnect-wallet');
    if (connectButton) connectButton.style.display = 'none';
    if (disconnectButton) disconnectButton.style.display = 'block';

    fetchNFTs(accountId);
  }

  // Disconnect
  async function disconnectWallet() {
    console.log('Disconnecting wallet');
    try {
      if (dAppConnector) {
        await dAppConnector.disconnect();
        dAppConnector = null;
        const walletStatus = document.getElementById('wallet-status');
        if (walletStatus) walletStatus.textContent = 'Wallet not connected';
        const connectButton = document.getElementById('connect-wallet');
        const disconnectButton = document.getElementById('disconnect-wallet');
        if (connectButton) connectButton.style.display = 'block';
        if (disconnectButton) disconnectButton.style.display = 'none';
        const nftList = document.getElementById('nft-list');
        if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Connect wallet to see NFTs</p>';
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  // Fetch NFTs using Mirror Node REST API
  async function fetchNFTs(accountId) {
    console.log('Fetching NFTs for account:', accountId);
    try {
      const response = await fetch(`https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts`);
      const data = await response.json();
      const nfts = data.nfts || [];
      const nftList = document.getElementById('nft-list');
      if (nftList) {
        nftList.innerHTML = await Promise.all(nfts.map(async nft => {
          let imageUrl = 'https://via.placeholder.com/150';
          if (nft.metadata) {
            // Decode the base64 metadata
            const metadataStr = atob(nft.metadata);
            console.log(`Decoded metadata for NFT ${nft.serial_number}:`, metadataStr);
            // Check if metadataStr is an IPFS URL
            if (metadataStr.startsWith('ipfs://')) {
              const ipfsHash = metadataStr.replace('ipfs://', '');
              const metadataUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
              console.log(`Fetching metadata from: ${metadataUrl}`);
              try {
                // Fetch the metadata JSON from the IPFS URL
                const metadataResponse = await fetch(metadataUrl);
                const metadata = await metadataResponse.json();
                console.log(`Metadata for NFT ${nft.serial_number}:`, metadata);
                if (metadata.image) {
                  // Handle the image URL from the metadata
                  if (metadata.image.startsWith('ipfs://')) {
                    const imageHash = metadata.image.replace('ipfs://', '');
                    imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
                  } else {
                    imageUrl = metadata.image;
                  }
                  console.log(`Final image URL for NFT ${nft.serial_number}:`, imageUrl);
                }
              } catch (e) {
                console.error(`Error fetching metadata from IPFS for NFT ${nft.serial_number}:`, e);
              }
            } else {
              // If metadataStr isn't an IPFS URL, try parsing it as JSON
              try {
                const metadata = JSON.parse(metadataStr);
                console.log(`Metadata for NFT ${nft.serial_number}:`, metadata);
                if (metadata.image) {
                  if (metadata.image.startsWith('ipfs://')) {
                    const imageHash = metadata.image.replace('ipfs://', '');
                    imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
                  } else {
                    imageUrl = metadata.image;
                  }
                  console.log(`Final image URL for NFT ${nft.serial_number}:`, imageUrl);
                }
              } catch (e) {
                console.error(`Metadata parse error for NFT ${nft.serial_number}:`, e);
              }
            }
          }
          return `
            <div class="nft-item" data-serial="${nft.serial_number}">
              <img src="${imageUrl}" alt="NFT" onclick="selectNFT(this)">
              <p>Serial: ${nft.serial_number}</p>
            </div>
          `;
        })).then(results => results.join(''));
      }
    } catch (error) {
      console.error('NFT fetch error:', error);
      const nftList = document.getElementById('nft-list');
      if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Error fetching NFTs</p>';
    }
  }

  // Select NFT for overlay
  let selectedNFT = null;
  window.selectNFT = function (img) {
    selectedNFT = img.src;
    document.querySelectorAll('.nft-item').forEach(item => item.classList.remove('selected'));
    img.parentElement.classList.add('selected');
    const canvasPlaceholder = document.getElementById('nft-display')?.querySelector('.canvas-placeholder');
    if (canvasPlaceholder) canvasPlaceholder.style.display = 'none';
    drawCanvas();
  };

  // Start WalletConnect initialization
  initializeWalletConnect();
});

import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { LedgerId } from '@hashgraph/sdk';

let dAppConnector;
let selectedNFT = null;

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
        LedgerId.TESTNET,
        projectId,
        ['hedera_getAccountBalance', 'hedera_sign', 'hedera_signTransaction'],
        ['chainChanged', 'accountsChanged'],
        ['hedera:testnet']
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
              '/assets/Bonjour_Overlay.png',
              '/assets/Boombox_Overlay.png',
              '/assets/Coffee_Overlay.png',
              '/assets/Good_Morning_Overlay.png',
              '/assets/Goodnight_Overlay.png',
              '/assets/Mic_Overlay.png',
              '/assets/Sign_Overlay.png',
            ];
            overlayImg.src = overlays[index];
            drawCanvas();
          });
        }
      });

      // Canvas setup
      console.log('Setting up canvas listeners');
      const canvas = document.getElementById('nft-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        let isDragging = false;
        let overlayX = 0, overlayY = 0;

        canvas.addEventListener('mousedown', (e) => {
          isDragging = true;
          updateOverlayPosition(e);
        });
        canvas.addEventListener('mousemove', (e) => {
          if (isDragging) updateOverlayPosition(e);
        });
        canvas.addEventListener('mouseup', () => { isDragging = false; });
        canvas.addEventListener('mouseout', () => { isDragging = false; });

        window.drawCanvas = function () {
          if (!selectedNFT) return;
          const nftImg = new Image();
          const overlayImg = document.getElementById('overlay-img');
          nftImg.src = selectedNFT;
          nftImg.onload = () => {
            canvas.width = nftImg.width;
            canvas.height = nftImg.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(nftImg, 0, 0);
            if (overlayImg.src) {
              ctx.drawImage(overlayImg, overlayX, overlayY, 100, 100);
            }
          };
        };

        window.updateOverlayPosition = function (e) {
          const rect = canvas.getBoundingClientRect();
          overlayX = e.clientX - rect.left - 50;
          overlayY = e.clientY - rect.top - 50;
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
      const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts`);
      const data = await response.json();
      const nfts = data.nfts || [];
      const nftList = document.getElementById('nft-list');
      if (nftList) {
        nftList.innerHTML = nfts.map(nft => `
          <div class="nft-item" data-serial="${nft.serial_number}">
            <img src="${nft.metadata ? `data:image/png;base64,${nft.metadata}` : 'https://via.placeholder.com/150'}" alt="NFT" onclick="selectNFT(this)">
            <p>Serial: ${nft.serial_number}</p>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('NFT fetch error:', error);
      const nftList = document.getElementById('nft-list');
      if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Error fetching NFTs</p>';
    }
  }

  // Select NFT for overlay
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

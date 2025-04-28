import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { LedgerId } from '@hashgraph/sdk';

let dAppConnector;
const projectId = '19f08313224ac846097e6a722ab078fc';
const metadata = {
  name: 'Overlayz',
  description: 'NFT Overlay Tool for Hedera',
  url: 'http://localhost:5173',
  icons: ['https://via.placeholder.com/150?text=Overlayz'],
};

// Initialize WalletConnect
async function initializeWalletConnect() {
  try {
    dAppConnector = new DAppConnector(
      metadata,
      LedgerId.TESTNET,
      projectId,
      ['hedera_getAccountBalance', 'hedera_sign', 'hedera_signTransaction'],
      ['chainChanged', 'accountsChanged'],
      ['hedera:testnet']
    );
    
    await dAppConnector.init({ logger: 'error' });
    console.log('WalletConnect initialized');
    
    // Auto-connect
    const session = await dAppConnector.openModal();
    handleNewSession(session);
  } catch (error) {
    console.error('Wallet init error:', error);
    document.getElementById('wallet-status').textContent = 'Connection failed';
  }
}

// Handle new session
function handleNewSession(session) {
  const account = session.namespaces?.hedera?.accounts?.[0];
  if (!account) {
    console.error('No account found');
    return;
  }
  
  const accountId = account.split(':').pop();
  localStorage.setItem('hederaAccountId', accountId);
  document.getElementById('wallet-status').textContent = `Connected: ${accountId}`;
  document.getElementById('connect-wallet').textContent = 'Disconnect Wallet';
  document.getElementById('connect-wallet').classList.add('connected');
  
  // Fetch NFTs
  fetchNFTs(accountId);
}

// Disconnect
async function disconnectWallet() {
  try {
    if (dAppConnector) {
      await dAppConnector.disconnect();
      dAppConnector = null;
      document.getElementById('wallet-status').textContent = 'Wallet not connected';
      document.getElementById('connect-wallet').textContent = 'Connect Wallet';
      document.getElementById('connect-wallet').classList.remove('connected');
      document.getElementById('nft-list').innerHTML = '<p class="nft-placeholder">Connect wallet to see NFTs</p>';
    }
  } catch (error) {
    console.error('Disconnect error:', error);
  }
}

// Fetch NFTs using Mirror Node REST API
async function fetchNFTs(accountId) {
  try {
    const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts`);
    const data = await response.json();
    const nfts = data.nfts || [];
    const nftList = document.getElementById('nft-list');
    nftList.innerHTML = nfts.map(nft => `
      <div class="nft-item" data-serial="${nft.serial_number}">
        <img src="${nft.metadata ? `data:image/png;base64,${nft.metadata}` : 'https://via.placeholder.com/150'}" alt="NFT" onclick="selectNFT(this)">
        <p>Serial: ${nft.serial_number}</p>
      </div>
    `).join('');
  } catch (error) {
    console.error('NFT fetch error:', error);
    document.getElementById('nft-list').innerHTML = '<p class="nft-placeholder">Error fetching NFTs</p>';
  }
}

// Select NFT for overlay
let selectedNFT = null;

function selectNFT(img) {
  selectedNFT = img.src;
  document.querySelectorAll('.nft-item').forEach(item => item.classList.remove('selected'));
  img.parentElement.classList.add('selected');
  document.getElementById('nft-display').querySelector('.canvas-placeholder').style.display = 'none';
  drawCanvas();
}

// Handle overlay upload
document.getElementById('overlay-upload').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const overlayImg = document.getElementById('overlay-img');
    overlayImg.src = URL.createObjectURL(file);
    drawCanvas();
  }
});

// Preset overlays (placeholders)
document.getElementById('cowboy-hat').addEventListener('click', () => {
  const overlayImg = document.getElementById('overlay-img');
  overlayImg.src = 'https://via.placeholder.com/100?text=CowboyHat';
  drawCanvas();
});
document.getElementById('crown').addEventListener('click', () => {
  const overlayImg = document.getElementById('overlay-img');
  overlayImg.src = 'https://via.placeholder.com/100?text=Crown';
  drawCanvas();
});

// Canvas for overlay
const canvas = document.getElementById('nft-canvas');
const ctx = canvas.getContext('2d');
let isDragging = false;
let overlayX = 0,
  overlayY = 0;

function drawCanvas() {
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
      ctx.drawImage(overlayImg, overlayX, overlayY, 100, 100); // Adjustable size
    }
  };
}

// Drag overlay
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  updateOverlayPosition(e);
});
canvas.addEventListener('mousemove', (e) => {
  if (isDragging) updateOverlayPosition(e);
});
canvas.addEventListener('mouseup', () => { isDragging = false; });
canvas.addEventListener('mouseout', () => { isDragging = false; });

function updateOverlayPosition(e) {
  const rect = canvas.getBoundingClientRect();
  overlayX = e.clientX - rect.left - 50; // Center overlay
  overlayY = e.clientY - rect.top - 50;
  drawCanvas();
}

// Apply and save overlay
document.getElementById('apply-overlay').addEventListener('click', () => {
  if (selectedNFT) {
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = 'overlayed-nft.png';
    link.click();
  } else {
    alert('Select an NFT first!');
  }
});

// Wallet button
document.getElementById('connect-wallet').addEventListener('click', () => {
  const button = document.getElementById('connect-wallet');
  if (button.classList.contains('connected')) {
    disconnectWallet();
  } else {
    initializeWalletConnect();
  }
});

// Start
initializeWalletConnect();
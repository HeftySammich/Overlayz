import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { LedgerId } from '@hashgraph/sdk';
import Konva from 'konva';

let dAppConnector;
let stage, layer, overlayImage, transformer;
let selectedNFT = null;
let backgroundImage = null;
let currentNFTPage = 1;
let nftsPerPage = 10000; // Show all NFTs at once
let allNFTs = [];
let isLoadingMoreNFTs = false;
const IPFS_GATEWAYS = [
  'https://hashpack.infura-ipfs.io/ipfs/',
  'https://grumpy-bronze-chipmunk.myfilebase.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://gateway.lighthouse.storage/ipfs/'
];
const GATEWAY_TIMEOUT = 5000;
const ERROR_PLACEHOLDER = 'https://placehold.co/150x150/red/white?text=ERROR';

// Helper function to properly encode URLs
function encodeImageUrl(url) {
  return url.replace(/#/g, '%23')
            .replace(/\+/g, '%2B')
            .replace(/\s/g, '%20')
            .replace(/&/g, '%26');
}

// Helper function to try loading from multiple gateways
async function loadFromIPFS(ipfsHash, timeout = GATEWAY_TIMEOUT) {
  if (ipfsHash.startsWith('hcs://')) {
    try {
      const topicId = ipfsHash.replace('hcs://', '');
      console.log(`Loading HCS metadata for topic ID: ${topicId}`);
      return {
        name: "HCS Token",
        description: "Token with HCS metadata",
        image: getHashinalImageUrl(topicId)
      };
    } catch (error) {
      console.warn(`Failed to load HCS metadata: ${error.message}`);
    }
  }

  const hash = ipfsHash.replace('ipfs://', '');
  console.log(`Loading IPFS metadata for hash: ${hash}`);
  
  for (const gateway of IPFS_GATEWAYS) {
    const url = gateway + hash;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`Successfully loaded from gateway: ${gateway}`);
        return await response.json();
      }
    } catch (error) {
      console.warn(`Failed to load from gateway ${gateway}: ${error.message}`);
    }
  }
  
  return {
    name: "Failed to Load",
    description: "Could not load metadata from IPFS",
    image: ""
  };
}

// Helper function to get image URL from IPFS
async function getImageUrlFromIPFS(ipfsHash, timeout = GATEWAY_TIMEOUT) {
  const hash = ipfsHash.replace('ipfs://', '');
  console.log(`Getting image URL for IPFS hash: ${hash}`);
  
  for (const gateway of IPFS_GATEWAYS) {
    const url = gateway + hash;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        method: 'HEAD', 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`Image available at gateway: ${gateway}`);
        return encodeImageUrl(url);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.warn(`Image not available at gateway ${gateway}: ${error.message}`);
      }
    }
  }
  
  console.log(`All gateways failed, using first gateway as fallback for: ${hash}`);
  return encodeImageUrl(IPFS_GATEWAYS[0] + hash);
}

// Function to get Hashinal image URL using Kiloscribe CDN
async function getHashinalImageUrl(topicId) {
  if (topicId.startsWith('1/')) {
    topicId = topicId.replace('1/', '');
  }
  
  console.log(`Processing Hashinal with topic_id: "${topicId}"`);
  
  const corsProxy = 'https://corsproxy.io/?';
  
  try {
    const cdnUrl = `${corsProxy}https://kiloscribe.com/api/inscription-cdn/${topicId}`;
    console.log(`Fetching Hashinal from CDN: ${cdnUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(cdnUrl, { 
      signal: controller.signal,
      method: 'GET'
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`CDN HTTP error: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    console.log(`Content type: ${contentType}`);
    
    if (contentType && contentType.includes('image')) {
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`Received JSON data:`, data);

      if (data.image) {
        if (data.image.includes('hcs://')) {
          const hcsTopicId = data.image.match(/hcs:\/\/(?:1\/)?([0-9.]+)/)?.[1];
          if (hcsTopicId) {
            console.log(`Found HCS topic ID in image URL: ${hcsTopicId}`);
            return getHashinalImageUrl(hcsTopicId);
          }
        }
        
        let imageUrl;
        if (data.image.startsWith('http')) {
          imageUrl = data.image;
        } else if (data.image.startsWith('/')) {
          imageUrl = `https://kiloscribe.com${data.image}`;
        } else {
          imageUrl = `https://kiloscribe.com/${data.image}`;
        }
        
        console.log(`Found image URL in JSON: ${imageUrl}`);
        
        const imageResponse = await fetch(`${corsProxy}${imageUrl}`);
        if (!imageResponse.ok) {
          throw new Error(`Image fetch error: ${imageResponse.status}`);
        }
        
        const blob = await imageResponse.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        throw new Error('No image URL found in JSON response');
      }
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  } catch (error) {
    console.error(`Error fetching from Kiloscribe CDN: ${error.message}`);
    
    try {
      const directImageUrl = `${corsProxy}https://kiloscribe.com/api/inscription-image/${topicId}`;
      console.log(`Trying direct image URL: ${directImageUrl}`);
      
      const directResponse = await fetch(directImageUrl);
      if (directResponse.ok) {
        const blob = await directResponse.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } else {
        throw new Error(`Direct image HTTP error: ${directResponse.status}`);
      }
    } catch (directError) {
      console.error(`Error with direct image approach: ${directError.message}`);
      return `https://placehold.co/150x150/orange/white?text=HASHINAL-${topicId.split('.').pop().substring(0, 8)}`;
    }
  }
}

// Download and convert image to data URL
async function downloadAndConvertToDataUrl(url) {
  try {
    console.log(`Downloading image from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error downloading image: ${error.message}`);
    throw error;
  }
}

// DOM loaded
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
        url: 'https://overlayz.xyz',
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
            console.log('Overlay image set from file upload:', overlayImg.src);
            updateOverlayImage(overlayImg.src);
          }
        });
      }

      // Preset overlays
      console.log('Setting up overlay buttons');
      ['overlay1', 'overlay2', 'overlay3', 'overlay4', 'overlay5', 'overlay6', 'overlay7'].forEach((id, index) => {
        const button = document.getElementById(id);
        if (button) {
          button.addEventListener('click', () => {
            const overlays = [
              '/assets/arts/Good_Morning._Overlay.png',
              '/assets/arts/Mic.Overlay.png',
              '/assets/arts/Boombox.Overlay.png',
              '/assets/arts/Bonjour.Overlay.png',
              '/assets/arts/Sign.Overlay.png',
              '/assets/arts/Goodnight.Overlay.png',
              ''
            ];
            if (index < 6) {
              const overlayImg = document.getElementById('overlay-img');
              overlayImg.src = overlays[index];
              console.log(`Overlay button ${id} clicked, setting overlay to ${overlays[index]}`);
              updateOverlayImage(overlays[index]);
            }
          });
        } else {
          console.error(`Overlay button with ID ${id} not found`);
        }
      });

      // Apply overlay
      console.log('Setting up apply-overlay listener');
      const applyButton = document.getElementById('apply-overlay');
      if (applyButton) {
        applyButton.addEventListener('click', () => {
          if (selectedNFT && stage) {
            console.log('Apply overlay button clicked');
            
            const transformerVisible = transformer.visible();
            transformer.visible(false);
            layer.draw();
            
            const nftImg = new Image();
            nftImg.crossOrigin = 'Anonymous';
            nftImg.src = selectedNFT;
            
            nftImg.onload = () => {
              console.log('Original NFT dimensions for export:', nftImg.width, nftImg.height);
              
              if (overlayImage) {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                tempCanvas.width = nftImg.width;
                tempCanvas.height = nftImg.height;
                
                tempCtx.drawImage(nftImg, 0, 0, nftImg.width, nftImg.height);
                
                const stageWidth = stage.width();
                const stageHeight = stage.height();
                
                const scaleRatioX = nftImg.width / stageWidth;
                const scaleRatioY = nftImg.height / stageHeight;
                
                console.log('Stage dimensions:', stageWidth, stageHeight);
                console.log('Scale ratios:', scaleRatioX, scaleRatioY);
                
                const overlayWidth = overlayImage.width() * overlayImage.scaleX();
                const overlayHeight = overlayImage.height() * overlayImage.scaleY();
                const overlayX = overlayImage.x();
                const overlayY = overlayImage.y();
                const rotation = overlayImage.rotation();
                
                console.log('Overlay properties:', {
                  x: overlayX,
                  y: overlayY,
                  width: overlayWidth,
                  height: overlayHeight,
                  rotation: rotation
                });
                
                const centerX = overlayX + (overlayWidth / 2);
                const centerY = overlayY + (overlayHeight / 2);
                
                const scaledCenterX = centerX * scaleRatioX;
                const scaledCenterY = centerY * scaleRatioY;
                const scaledWidth = overlayWidth * scaleRatioX;
                const scaledHeight = overlayHeight * scaleRatioY;
                
                console.log('Scaled overlay center:', scaledCenterX, scaledCenterY);
                console.log('Scaled overlay dimensions:', scaledWidth, scaledHeight);
                
                const overlayImg = new Image();
                overlayImg.crossOrigin = 'Anonymous';
                overlayImg.src = overlayImage.image().src;
                
                overlayImg.onload = () => {
                  tempCtx.save();
                  
                  tempCtx.translate(scaledCenterX, scaledCenterY);
                  
                  tempCtx.rotate(rotation * Math.PI / 180);
                  
                  tempCtx.drawImage(
                    overlayImg,
                    -scaledWidth / 2,
                    -scaledHeight / 2,
                    scaledWidth,
                    scaledHeight
                  );
                  
                  tempCtx.restore();
                  
                  const dataURL = tempCanvas.toDataURL('image/png');
                  console.log('Final canvas exported at original NFT size');
                  
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  
                  if (isMobile) {
                    if (navigator.share) {
                      fetch(dataURL)
                        .then(res => res.blob())
                        .then(blob => {
                          const file = new File([blob], 'overlayz-nft.png', { type: 'image/png' });
                          navigator.share({
                            title: 'My Overlayed NFT',
                            files: [file]
                          }).catch(error => {
                            console.error('Error sharing:', error);
                            showImageShareModal(dataURL);
                          });
                        });
                    } else {
                      showImageShareModal(dataURL);
                    }
                  } else {
                    const link = document.createElement('a');
                    link.href = dataURL;
                    link.download = 'overlayed-nft.png';
                    link.click();
                  }
                  
                  transformer.visible(transformerVisible);
                  layer.draw();
                };
                
                overlayImg.onerror = () => {
                  console.error('Failed to load overlay image for export');
                  alert('Failed to export image. Please try again.');
                  tempCtx.restore();
                  transformer.visible(transformerVisible);
                  layer.draw();
                };
              } else {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = nftImg.width;
                tempCanvas.height = nftImg.height;
                tempCtx.drawImage(nftImg, 0, 0, nftImg.width, nftImg.height);
                
                const dataURL = tempCanvas.toDataURL('image/png');
                
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                
                if (isMobile) {
                  showImageShareModal(dataURL);
                } else {
                  const link = document.createElement('a');
                  link.href = dataURL;
                  link.download = 'nft.png';
                  link.click();
                }
                
                transformer.visible(transformerVisible);
                layer.draw();
              }
            };
            
            nftImg.onerror = () => {
              console.error('Failed to load NFT for export');
              alert('Failed to export image. Please try again.');
              transformer.visible(transformerVisible);
              layer.draw();
            };
          } else {
            alert('Select an NFT first!');
          }
        });
      }

      // Initialize Konva stage
      initKonvaStage();
      
    } catch (error) {
      console.error('Wallet init error:', error);
    }
  }

  // Initialize Konva stage - SIMPLIFIED VERSION
  function initKonvaStage() {
    console.log('Initializing Konva stage');
    const container = document.getElementById('nft-display');
    if (!container) {
      console.error('nft-display container not found');
      return;
    }

    // Clear any existing content
    container.innerHTML = '';
    
    // Create Konva stage
    stage = new Konva.Stage({
      container: 'nft-display',
      width: 400,
      height: 400,
    });
    
    console.log('Konva stage created with dimensions:', stage.width(), stage.height());

    // Create layer
    layer = new Konva.Layer();
    stage.add(layer);
    
    // Create transformer
    transformer = new Konva.Transformer({
      nodes: [],
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      borderStroke: '#00ff40',
      borderStrokeWidth: 2,
      anchorStroke: '#00ff40',
      anchorFill: '#000',
      anchorSize: 12,
      rotateEnabled: true,
      resizeEnabled: true,
      keepRatio: true
    });
    
    layer.add(transformer);
    
    // Stage click handler for deselection
    stage.on('click tap', function(e) {
      // Only deselect if clicking directly on stage or background
      if (e.target === stage || e.target === backgroundImage) {
        console.log('Stage clicked, deselecting transformer');
        transformer.nodes([]);
        layer.draw();
      } else if (e.target === overlayImage) {
        // Ensure overlay is selectable by clicking anywhere on it
        console.log('Overlay clicked, selecting');
        transformer.nodes([overlayImage]);
        layer.draw();
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      stage.width(containerWidth);
      stage.height(containerHeight);
      stage.draw();
    });
    
    // Initial resize
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    stage.width(containerWidth);
    stage.height(containerHeight);
    
    console.log('Konva stage initialized with size:', containerWidth, containerHeight);
  }

  // Draw NFT background
  function drawNFTBackground() {
    if (!selectedNFT || !stage) {
      console.log('No NFT selected or stage not initialized');
      return;
    }

    console.log('Drawing NFT background:', selectedNFT);

    if (backgroundImage) {
      backgroundImage.remove();
      backgroundImage = null;
    }

    const nftImg = new Image();
    nftImg.src = selectedNFT;
    nftImg.crossOrigin = 'Anonymous';
    
    nftImg.onload = () => {
      console.log('NFT image loaded, dimensions:', nftImg.width, nftImg.height);
      
      backgroundImage = new Konva.Image({
        image: nftImg,
        width: stage.width(),
        height: stage.height(),
        x: 0,
        y: 0,
      });
      
      layer.add(backgroundImage);
      backgroundImage.moveToBottom();
      layer.draw();
      console.log('NFT background image added to layer');
    };
    
    nftImg.onerror = () => {
      console.error('Failed to load NFT image:', nftImg.src);
    };
  }

  // Update Overlay Image - ENHANCED FOR DESKTOP WITH CONSISTENT DRAG
  function updateOverlayImage(src) {
    if (!selectedNFT || !stage) {
      console.log('No NFT selected or stage not initialized');
      return;
    }

    console.log('Updating overlay image:', src);

    // Remove existing overlay
    if (overlayImage) {
      overlayImage.remove();
      overlayImage = null;
    }
    
    // Reset transformer
    transformer.nodes([]);
    layer.draw();

    if (!src || src === window.location.href) {
      console.log('No valid overlay source');
      return;
    }

    const overlay = new Image();
    overlay.crossOrigin = 'Anonymous';
    overlay.src = src;

    overlay.onload = () => {
      console.log('Overlay image loaded, dimensions:', overlay.width, overlay.height);

      // Calculate size to fit within 50% of stage
      const maxWidth = stage.width() * 0.5;
      const aspectRatio = overlay.height / overlay.width;
      let overlayWidth = maxWidth;
      let overlayHeight = overlayWidth * aspectRatio;

      // Adjust if overlay is too tall
      if (overlayHeight > stage.height() * 0.5) {
        overlayHeight = stage.height() * 0.5;
        overlayWidth = overlayHeight / aspectRatio;
      }

      // Create a simple image - no groups, no hit detection tricks
      const image = new Konva.Image({
        image: overlay,
        width: overlayWidth,
        height: overlayHeight,
        x: stage.width() / 2 - overlayWidth / 2,
        y: stage.height() / 2 - overlayHeight / 2,
        draggable: true
      });

      // Add the image to the layer
      layer.add(image);
      
      // Store reference to the image
      overlayImage = image;
      
      // Select the image with transformer
      transformer.nodes([image]);
      layer.draw();
      
      // Add click handler to the image
      image.on('click tap', function(e) {
        e.cancelBubble = true;
        transformer.nodes([image]);
        layer.draw();
      });
      
      // Add click handler to the stage
      stage.off('click tap');
      stage.on('click tap', function(e) {
        if (e.target === stage || e.target === backgroundImage) {
          transformer.nodes([]);
          layer.draw();
        }
      });
      
      console.log('Simple overlay added');
    };

    overlay.onerror = () => {
      console.error('Failed to load overlay image:', src);
    };
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

  // Fetch NFTs
  async function fetchNFTs(accountId) {
    console.log('Fetching NFTs for account:', accountId);
    try {
      const nftList = document.getElementById('nft-list');
      if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Loading NFTs...</p>';
      
      allNFTs = [];
      let nextLink = null;
      
      try {
        let url = `https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?limit=50`;
        
        do {
          console.log(`Fetching NFTs from: ${url}`);
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            const newNFTs = data.nfts || [];
            
            allNFTs = [...allNFTs, ...newNFTs];
            console.log(`Fetched ${newNFTs.length} more NFTs, total now: ${allNFTs.length}`);
            
            nextLink = data.links && data.links.next;
            url = nextLink ? `https://mainnet.mirrornode.hedera.com${nextLink}` : null;
          } else {
            console.error('Failed to fetch NFTs:', response.status, response.statusText);
            break;
          }
        } while (url);
        
        console.log(`Total NFTs fetched: ${allNFTs.length}`);
        
        const wildTigers = allNFTs.filter(nft => nft.token_id === '0.0.6024491');
        const fugitivesTeam = allNFTs.filter(nft => nft.token_id === '0.0.963963');
        const emrakCubit = allNFTs.filter(nft => nft.token_id === '0.0.732384');
        
        console.log('Wild Tigers found:', wildTigers.length);
        console.log('Fugitives Team found:', fugitivesTeam.length);
        console.log('Emrak (Cubit) found:', emrakCubit.length);
        
        let hashinalCount = 0;
        for (const nft of allNFTs) {
          if (nft.metadata) {
            try {
              const metadataStr = atob(nft.metadata);
              if (metadataStr.startsWith('hcs://')) {
                hashinalCount++;
                let topicId = metadataStr.replace('hcs://', '');
                if (topicId.startsWith('1/')) {
                  topicId = topicId.replace('1/', '');
                }
                console.log(`Found Hashinal with topic_id: ${topicId}`);
                nft.topic_id = topicId;
              }
            } catch (e) {
              console.error(`Error decoding metadata for NFT ${nft.token_id}#${nft.serial_number}: ${e.message}`);
            }
          }
        }
        console.log(`Identified ${hashinalCount} Hashinals from metadata`);
        
        displayNFTPage(1);
      } catch (error) {
        console.error('Error fetching regular NFTs:', error);
        const nftList = document.getElementById('nft-list');
        if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Error fetching NFTs</p>';
      }
    } catch (error) {
      console.error('NFT fetch error:', error);
      const nftList = document.getElementById('nft-list');
      if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Error fetching NFTs</p>';
    }
  }

  // Display NFT page
  async function displayNFTPage(page) {
    console.log(`Displaying NFT page ${page}`);
    const nftList = document.getElementById('nft-list');
    if (!nftList) return;
    
    nftList.innerHTML = '';
    
    if (allNFTs.length === 0) {
      nftList.innerHTML = '<p class="nft-placeholder">No NFTs found</p>';
      return;
    }
    
    const loadingIndicator = document.createElement('p');
    loadingIndicator.className = 'nft-placeholder';
    loadingIndicator.textContent = `Loading ${allNFTs.length} NFTs...`;
    nftList.appendChild(loadingIndicator);
    
    const batchSize = 5;
    const totalNFTs = allNFTs.length;
    let processedCount = 0;
    let hashinalProcessed = 0;
    
    async function processBatch(startIndex) {
      if (startIndex === 0) {
        nftList.removeChild(loadingIndicator);
      }
      
      const endIndex = Math.min(startIndex + batchSize, totalNFTs);
      
      for (let i = startIndex; i < endIndex; i++) {
        const nft = allNFTs[i];
        try {
          let imageUrl = "";
          let nftName = `NFT #${nft.serial_number}`;
          let isHashinal = false;
          
          if (nft.topic_id) {
            console.log(`Processing Hashinal with topic_id: ${nft.topic_id}`);
            
            try {
              imageUrl = await getHashinalImageUrl(nft.topic_id);
              nftName = `Hashinal #${nft.serial_number}`;
              isHashinal = true;
              hashinalProcessed++;
              
              const nftElement = document.createElement('div');
              nftElement.className = 'nft-item';
              nftElement.dataset.serial = nft.serial_number;
              nftElement.dataset.tokenId = nft.token_id;
              nftElement.dataset.hashinal = 'true';
              nftElement.dataset.topicId = nft.topic_id;

              const placeholderUrl = `https://placehold.co/150x150/orange/white?text=HASHINAL-${nft.topic_id.substring(0, 8)}`;
              nftElement.innerHTML = `
                <img 
                  src="${placeholderUrl}" 
                  alt="${nftName}" 
                  crossorigin="anonymous"
                  referrerpolicy="no-referrer"
                  data-topic-id="${nft.topic_id}"
                  onclick="selectNFT(this)">
                <p>${nftName}</p>
                <small class="topic-id">${nft.topic_id}</small>
              `;

              nftList.appendChild(nftElement);
              processedCount++;

              getHashinalImageUrl(nft.topic_id)
                .then(imageUrl => {
                  const imgElement = nftElement.querySelector('img');
                  if (imgElement) {
                    imgElement.src = imageUrl;
                  }
                })
                .catch(error => {
                  console.error(`Failed to load Hashinal image: ${error.message}`);
                });

              continue;
            } catch (error) {
              console.error(`Error processing Hashinal: ${error.message}`);
            }
          }
          else if (nft.metadata) {
            try {
              const metadataStr = atob(nft.metadata);
              
              if (metadataStr.startsWith('hcs://')) {
                const topicId = metadataStr.replace('hcs://', '');
                console.log(`Found HCS token with topic_id: ${topicId}`);
                
                imageUrl = await getHashinalImageUrl(topicId);
                nftName = `Hashinal #${nft.serial_number}`;
                isHashinal = true;
                hashinalProcessed++;
              }
              else if (metadataStr.startsWith('ipfs://')) {
                try {
                  const metadata = await loadFromIPFS(metadataStr);
                  if (metadata.image) {
                    if (metadata.image.startsWith('ipfs://')) {
                      imageUrl = await getImageUrlFromIPFS(metadata.image);
                    } else {
                      imageUrl = encodeImageUrl(metadata.image);
                    }
                  }
                  if (metadata.name) {
                    nftName = metadata.name;
                  }
                } catch (e) {
                  console.error(`Error loading IPFS metadata: ${e.message}`);
                }
              } else {
                try {
                  const metadata = JSON.parse(metadataStr);
                  if (metadata.image) {
                    if (metadata.image.startsWith('ipfs://')) {
                      imageUrl = await getImageUrlFromIPFS(metadata.image);
                    } else {
                      imageUrl = encodeImageUrl(metadata.image);
                    }
                  } else if (metadata.media) {
                    if (metadata.media.startsWith('ipfs://')) {
                      imageUrl = await getImageUrlFromIPFS(metadata.media);
                    } else {
                      imageUrl = encodeImageUrl(metadata.media);
                    }
                  }
                  if (metadata.name) {
                    nftName = metadata.name;
                  }
                } catch (e) {
                  if (metadataStr.startsWith('http')) {
                    imageUrl = encodeImageUrl(metadataStr);
                  }
                }
              }
            } catch (e) {
              console.error(`Error processing metadata: ${e.message}`);
            }
          }
          
          const nftElement = document.createElement('div');
          nftElement.className = 'nft-item';
          nftElement.dataset.serial = nft.serial_number;
          nftElement.dataset.tokenId = nft.token_id;
          if (isHashinal) {
            nftElement.dataset.hashinal = 'true';
            nftElement.dataset.topicId = nft.topic_id || metadataStr?.replace('hcs://', '');
          }
          
          nftElement.innerHTML = `
            <img 
              src="${imageUrl}" 
              alt="${nftName}" 
              crossorigin="anonymous"
              onerror="this.onerror=null; this.src='${ERROR_PLACEHOLDER}';" 
              onclick="selectNFT(this)">
            <p>${nftName}</p>
            ${isHashinal ? `<small class="topic-id">${nft.topic_id}</small>` : ''}
          `;
          
          nftList.appendChild(nftElement);
          processedCount++;
          
        } catch (error) {
          console.error(`Error processing NFT ${nft.token_id}#${nft.serial_number}:`, error);
          processedCount++;
        }
      }
      
      if (processedCount < totalNFTs) {
        setTimeout(() => processBatch(endIndex), 10);
      } else {
        console.log(`Finished loading all ${processedCount} NFTs, including ${hashinalProcessed} Hashinals`);
      }
    }
    
    processBatch(0);
  }

  // Select NFT
  window.selectNFT = function (img) {
    console.log('NFT selected:', img.src);
    selectedNFT = img.src;
    document.querySelectorAll('.nft-item').forEach(item => item.classList.remove('selected'));
    img.parentElement.classList.add('selected');
    const canvasPlaceholder = document.getElementById('nft-display')?.querySelector('.canvas-placeholder');
    if (canvasPlaceholder) canvasPlaceholder.style.display = 'none';
    
    drawNFTBackground();
    
    const overlayImg = document.getElementById('overlay-img');
    if (overlayImg && overlayImg.src && overlayImg.src !== window.location.href) {
      updateOverlayImage(overlayImg.src);
    }
  };

  initializeWalletConnect();
});

// Image share modal
function showImageShareModal(imageDataURL) {
  const modalContainer = document.createElement('div');
  modalContainer.style.position = 'fixed';
  modalContainer.style.top = '0';
  modalContainer.style.left = '0';
  modalContainer.style.width = '100%';
  modalContainer.style.height = '100%';
  modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  modalContainer.style.zIndex = '1000';
  modalContainer.style.display = 'flex';
  modalContainer.style.flexDirection = 'column';
  modalContainer.style.alignItems = 'center';
  modalContainer.style.justifyContent = 'center';
  modalContainer.style.padding = '20px';
  
  const imageElement = document.createElement('img');
  imageElement.src = imageDataURL;
  imageElement.style.maxWidth = '90%';
  imageElement.style.maxHeight = '70%';
  imageElement.style.objectFit = 'contain';
  imageElement.style.borderRadius = '8px';
  imageElement.style.marginBottom = '20px';
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save to Photos';
  saveButton.className = 'btn';
  saveButton.style.marginBottom = '10px';
  saveButton.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = imageDataURL;
    link.download = 'overlayz-nft.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.className = 'btn';
  closeButton.style.marginTop = '10px';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modalContainer);
  });
  
  modalContainer.appendChild(imageElement);
  modalContainer.appendChild(saveButton);
  modalContainer.appendChild(closeButton);
  
  document.body.appendChild(modalContainer);
  
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      document.body.removeChild(modalContainer);
    }
  });
}

// Log NFT details
function logNFTDetails(nft) {
  console.log(`NFT Details for ${nft.token_id}#${nft.serial_number}:`);
  console.log('- Token ID:', nft.token_id);
  console.log('- Serial Number:', nft.serial_number);
  console.log('- Metadata:', nft.metadata ? `Present (${nft.metadata.length} bytes)` : 'Missing');
  
  if (nft.metadata) {
    try {
      const decodedMetadata = atob(nft.metadata);
      console.log('- Decoded Metadata:', decodedMetadata.substring(0, 100) + '...');
      
      if (decodedMetadata.trim().startsWith('{')) {
        try {
          const jsonMetadata = JSON.parse(decodedMetadata);
          console.log('- JSON Metadata:', jsonMetadata);
          console.log('- Has Image:', jsonMetadata.image ? 'Yes' : 'No');
        } catch (e) {
          console.log('- Not valid JSON metadata');
        }
      }
    } catch (e) {
      console.log('- Failed to decode metadata:', e.message);
    }
  }
}

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
  'https://hashpack.infura-ipfs.io/ipfs/',            // HashPack's gateway first
  'https://grumpy-bronze-chipmunk.myfilebase.com/ipfs/', 
  'https://gateway.pinata.cloud/ipfs/',                  
  'https://gateway.lighthouse.storage/ipfs/'            
];
const GATEWAY_TIMEOUT = 5000; // 5 seconds timeout for each gateway

// Remove placeholder constants since we'll be loading actual images
// const PLACEHOLDER_IMAGE = 'https://placehold.co/150x150/gray/white?text=NFT';
// const SLIME_PLACEHOLDER = 'https://placehold.co/150x150/green/white?text=SLIME';
// const HASHINAL_PLACEHOLDER = 'https://placehold.co/150x150/orange/white?text=HASHINAL';
// const HCS_PLACEHOLDER = 'https://placehold.co/150x150/blue/white?text=HCS';
const ERROR_PLACEHOLDER = 'https://placehold.co/150x150/red/white?text=ERROR';

// Helper function to properly encode URLs
function encodeImageUrl(url) {
  // Replace # with %23 and handle other special characters
  return url.replace(/#/g, '%23')
            .replace(/\+/g, '%2B')
            .replace(/\s/g, '%20')
            .replace(/&/g, '%26');
}

// Helper function to try loading from multiple gateways with better error handling
async function loadFromIPFS(ipfsHash, timeout = GATEWAY_TIMEOUT) {
  // Check if this is an HCS URL, not IPFS
  if (ipfsHash.startsWith('hcs://')) {
    try {
      // Extract the topic ID from the HCS URL
      const topicId = ipfsHash.replace('hcs://', '');
      console.log(`Loading HCS metadata for topic ID: ${topicId}`);
      return {
        name: "HCS Token",
        description: "Token with HCS metadata",
        image: getHashinalImageUrl(topicId) // Use Kiloscribe CDN for HCS tokens too
      };
    } catch (error) {
      console.warn(`Failed to load HCS metadata: ${error.message}`);
    }
  }

  // Remove ipfs:// prefix if present
  const hash = ipfsHash.replace('ipfs://', '');
  console.log(`Loading IPFS metadata for hash: ${hash}`);
  
  // Try each gateway in sequence
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
      // Continue to next gateway
    }
  }
  
  // If all gateways fail, return a basic metadata object
  return {
    name: "Failed to Load",
    description: "Could not load metadata from IPFS",
    image: "" // No placeholder, will trigger onerror handler
  };
}

// Helper function to get image URL from IPFS
async function getImageUrlFromIPFS(ipfsHash, timeout = GATEWAY_TIMEOUT) {
  // Remove ipfs:// prefix if present
  const hash = ipfsHash.replace('ipfs://', '');
  console.log(`Getting image URL for IPFS hash: ${hash}`);
  
  // Try each gateway in sequence
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
        return encodeImageUrl(url); // Ensure URL is properly encoded
      }
    } catch (error) {
      // Only log if it's not an abort error (which is expected for timeouts)
      if (error.name !== 'AbortError') {
        console.warn(`Image not available at gateway ${gateway}: ${error.message}`);
      }
      // Continue to next gateway
    }
  }
  
  // If all gateways fail, return the first gateway as last resort
  console.log(`All gateways failed, using first gateway as fallback for: ${hash}`);
  return encodeImageUrl(IPFS_GATEWAYS[0] + hash);
}

// Function to get Hashinal image URL
async function getHashinalImageUrl(topicId) {
  // Extract the clean topic ID
  const cleanTopicId = topicId.includes('/') ? topicId.split('/')[1] : topicId;
  
  // First, fetch the metadata
  const metadataUrl = `https://kiloscribe.com/api/inscription-cdn/${cleanTopicId}`;
  console.log(`Fetching Hashinal metadata from: ${metadataUrl}`);
  
  try {
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    // Parse the JSON metadata
    const metadata = await response.json();
    console.log('Hashinal metadata:', metadata);
    
    // Extract the image URL from the metadata
    if (metadata && metadata.image) {
      console.log(`Found image URL in metadata: ${metadata.image}`);
      return metadata.image;
    } else if (metadata && metadata.content) {
      // Some Hashinals might store the image in 'content' field
      console.log(`Found content URL in metadata: ${metadata.content}`);
      return metadata.content;
    } else {
      throw new Error('No image URL found in metadata');
    }
  } catch (error) {
    console.error(`Error fetching Hashinal metadata: ${error.message}`);
    // Return a placeholder or error image
    return ERROR_PLACEHOLDER;
  }
}

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
            
            // Temporarily hide transformer to avoid it showing in the export
            const transformerVisible = transformer.visible();
            transformer.visible(false);
            layer.draw();
            
            // Load original NFT to get its dimensions
            const nftImg = new Image();
            nftImg.crossOrigin = 'Anonymous';
            nftImg.src = selectedNFT;
            
            nftImg.onload = () => {
              console.log('Original NFT dimensions for export:', nftImg.width, nftImg.height);
              
              if (overlayImage) {
                // Create a temporary canvas for the final image
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // Set canvas to original NFT dimensions
                tempCanvas.width = nftImg.width;
                tempCanvas.height = nftImg.height;
                
                // Draw the original NFT as background
                tempCtx.drawImage(nftImg, 0, 0, nftImg.width, nftImg.height);
                
                // Get the current stage dimensions
                const stageWidth = stage.width();
                const stageHeight = stage.height();
                
                // Calculate the scale ratio between original image and stage
                const scaleRatioX = nftImg.width / stageWidth;
                const scaleRatioY = nftImg.height / stageHeight;
                
                console.log('Stage dimensions:', stageWidth, stageHeight);
                console.log('Scale ratios:', scaleRatioX, scaleRatioY);
                
                // Get overlay properties directly from Konva
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
                
                // Calculate center point of overlay in stage coordinates
                const centerX = overlayX + (overlayWidth / 2);
                const centerY = overlayY + (overlayHeight / 2);
                
                // Scale to output dimensions
                const scaledCenterX = centerX * scaleRatioX;
                const scaledCenterY = centerY * scaleRatioY;
                const scaledWidth = overlayWidth * scaleRatioX;
                const scaledHeight = overlayHeight * scaleRatioY;
                
                console.log('Scaled overlay center:', scaledCenterX, scaledCenterY);
                console.log('Scaled overlay dimensions:', scaledWidth, scaledHeight);
                
                // Create a new image for the overlay
                const overlayImg = new Image();
                overlayImg.crossOrigin = 'Anonymous';
                overlayImg.src = overlayImage.image().src;
                
                overlayImg.onload = () => {
                  // Apply transformations to draw the overlay
                  tempCtx.save();
                  
                  // Move to the center point of where the overlay should be
                  tempCtx.translate(scaledCenterX, scaledCenterY);
                  
                  // Apply rotation
                  tempCtx.rotate(rotation * Math.PI / 180);
                  
                  // Draw the overlay centered at the rotation point
                  tempCtx.drawImage(
                    overlayImg,
                    -scaledWidth / 2,  // Center the overlay horizontally
                    -scaledHeight / 2, // Center the overlay vertically
                    scaledWidth,
                    scaledHeight
                  );
                  
                  tempCtx.restore();
                  
                  // Export the final canvas
                  const dataURL = tempCanvas.toDataURL('image/png');
                  console.log('Final canvas exported at original NFT size');
                  
                  // Check if we're on mobile
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  
                  if (isMobile) {
                    // Use Web Share API if available
                    if (navigator.share) {
                      // Convert dataURL to Blob for sharing
                      fetch(dataURL)
                        .then(res => res.blob())
                        .then(blob => {
                          const file = new File([blob], 'overlayz-nft.png', { type: 'image/png' });
                          navigator.share({
                            title: 'My Overlayed NFT',
                            files: [file]
                          }).catch(error => {
                            console.error('Error sharing:', error);
                            // Fallback to modal if sharing fails
                            showImageShareModal(dataURL);
                          });
                        });
                    } else {
                      // Fallback for browsers without Web Share API
                      showImageShareModal(dataURL);
                    }
                  } else {
                    // Desktop behavior - download the image
                    const link = document.createElement('a');
                    link.href = dataURL;
                    link.download = 'overlayed-nft.png';
                    link.click();
                  }
                  
                  // Restore transformer visibility
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
                // No overlay, just export the NFT
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = nftImg.width;
                tempCanvas.height = nftImg.height;
                tempCtx.drawImage(nftImg, 0, 0, nftImg.width, nftImg.height);
                
                const dataURL = tempCanvas.toDataURL('image/png');
                
                // Check if we're on mobile
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                
                if (isMobile) {
                  // Create a modal to display the image for mobile
                  showImageShareModal(dataURL);
                } else {
                  // Desktop behavior - download the image
                  const link = document.createElement('a');
                  link.href = dataURL;
                  link.download = 'nft.png';
                  link.click();
                }
                
                // Restore transformer visibility
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

  // Initialize Konva stage
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
      rotationSnaps: [0, 90, 180, 270],
      borderStroke: '#00ff40',
      borderStrokeWidth: 2,
      anchorStroke: '#00ff40',
      anchorFill: '#000',
      anchorSize: 10,
      rotateEnabled: true,
      resizeEnabled: true,
    });
    
    layer.add(transformer);
    
    console.log('Konva transformer added to layer');
    
    // Add stage click handler to deselect
    stage.on('click tap', function(e) {
      // If we clicked on the stage but not on the transformer or overlay
      if (e.target === stage) {
        console.log('Stage clicked, deselecting transformer');
        transformer.nodes([]);
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
      console.log('Resized stage to:', containerWidth, containerHeight);
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

    // Remove previous background if exists
    if (backgroundImage) {
      backgroundImage.remove();
      backgroundImage = null;
    }

    // Load NFT image
    const nftImg = new Image();
    nftImg.src = selectedNFT;
    nftImg.crossOrigin = 'Anonymous';
    
    nftImg.onload = () => {
      console.log('NFT image loaded, dimensions:', nftImg.width, nftImg.height);
      
      // Create background image with NFT
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

  // Update overlay image
  function updateOverlayImage(src) {
    if (!selectedNFT || !stage) {
      console.log('No NFT selected or stage not initialized');
      return;
    }

    console.log('Updating overlay image:', src);

    // Remove previous overlay if exists
    if (overlayImage) {
      overlayImage.remove();
      overlayImage = null;
    }

    if (!src || src === window.location.href) {
      console.log('No valid overlay source');
      layer.draw();
      return;
    }

    // Load overlay image
    const overlay = new Image();
    overlay.crossOrigin = 'Anonymous';
    overlay.src = src;
    
    overlay.onload = () => {
      console.log('Overlay image loaded, dimensions:', overlay.width, overlay.height);
      
      // Calculate size to maintain aspect ratio
      let overlayWidth = stage.width() / 2;
      let overlayHeight = (overlay.height / overlay.width) * overlayWidth;
      
      // Create overlay with Konva
      overlayImage = new Konva.Image({
        image: overlay,
        width: overlayWidth,
        height: overlayHeight,
        x: stage.width() / 4,
        y: stage.height() / 4,
        draggable: true,
      });
      
      console.log('Konva overlay image created with dimensions:', overlayWidth, overlayHeight);
      
      // Add overlay to layer
      layer.add(overlayImage);
      
      // Add click handler to select overlay
      overlayImage.on('click tap', function(e) {
        console.log('Overlay clicked/tapped');
        // Prevent event bubbling
        e.cancelBubble = true;
        
        // Select this overlay with transformer
        transformer.nodes([overlayImage]);
        layer.draw();
      });
      
      // Add drag handlers for better mobile experience
      overlayImage.on('dragstart', function() {
        console.log('Drag started on overlay');
        transformer.nodes([overlayImage]);
      });
      
      overlayImage.on('dragmove', function() {
        console.log('Dragging overlay, position:', overlayImage.x(), overlayImage.y());
      });
      
      overlayImage.on('dragend', function() {
        console.log('Drag ended on overlay');
        layer.draw();
      });
      
      // Set initial transformer
      transformer.nodes([overlayImage]);
      layer.draw();
      
      console.log('Overlay added and transformer attached');
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

  // Fetch NFTs using Mirror Node REST API
  async function fetchNFTs(accountId) {
    console.log('Fetching NFTs for account:', accountId);
    try {
      const nftList = document.getElementById('nft-list');
      if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Loading NFTs...</p>';
      
      // Fetch regular NFTs
      try {
        const response = await fetch(`https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts`);
        if (response.ok) {
          const data = await response.json();
          allNFTs = data.nfts || [];
          console.log(`Fetched ${allNFTs.length} NFTs from Mirror Node`);
          
          // Log some sample NFTs for debugging
          if (allNFTs.length > 0) {
            console.log('Sample NFT data:', allNFTs[0]);
          }
          
          // Check for Hashinals by looking at metadata
          let hashinalCount = 0;
          for (const nft of allNFTs) {
            if (nft.metadata) {
              try {
                const metadataStr = atob(nft.metadata);
                console.log(`NFT ${nft.token_id}#${nft.serial_number} metadata: ${metadataStr.substring(0, 50)}...`);
                if (metadataStr.startsWith('hcs://')) {
                  hashinalCount++;
                  // Extract the topic ID from the HCS URL
                  const topicId = metadataStr.replace('hcs://', '');
                  console.log(`Found Hashinal with topic_id: ${topicId}`);
                  // Store the topic_id in the NFT object for later use
                  nft.topic_id = topicId;
                }
              } catch (e) {
                console.error(`Error decoding metadata for NFT ${nft.token_id}#${nft.serial_number}: ${e.message}`);
              }
            }
          }
          console.log(`Identified ${hashinalCount} Hashinals from metadata`);
        } else {
          console.error('Failed to fetch NFTs:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching regular NFTs:', error);
      }
      
      // Display NFTs with better error handling
      displayNFTPage(1);
    } catch (error) {
      console.error('NFT fetch error:', error);
      const nftList = document.getElementById('nft-list');
      if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Error fetching NFTs</p>';
    }
  }

  // New function to display a specific page of NFTs
  async function displayNFTPage(page) {
    console.log(`Displaying NFT page ${page}`);
    const nftList = document.getElementById('nft-list');
    if (!nftList) return;
    
    // Clear previous content
    nftList.innerHTML = '';
    
    if (allNFTs.length === 0) {
      nftList.innerHTML = '<p class="nft-placeholder">No NFTs found</p>';
      return;
    }
    
    // Create a loading indicator
    const loadingIndicator = document.createElement('p');
    loadingIndicator.className = 'nft-placeholder';
    loadingIndicator.textContent = `Loading ${allNFTs.length} NFTs...`;
    nftList.appendChild(loadingIndicator);
    
    // Use a more efficient approach - process in batches
    const batchSize = 5;
    const totalNFTs = allNFTs.length;
    let processedCount = 0;
    let hashinalProcessed = 0;
    
    // Process NFTs in batches to avoid overwhelming the browser
    async function processBatch(startIndex) {
      // Remove loading indicator once we start processing
      if (startIndex === 0) {
        nftList.removeChild(loadingIndicator);
      }
      
      const endIndex = Math.min(startIndex + batchSize, totalNFTs);
      
      for (let i = startIndex; i < endIndex; i++) {
        const nft = allNFTs[i];
        try {
          let imageUrl = "";  // Default to empty string, not a placeholder
          let nftName = `NFT #${nft.serial_number}`;
          let isHashinal = false;
          
          // Check if this is a Hashinal (has topic_id)
          if (nft.topic_id) {
            console.log(`Processing Hashinal with topic_id: ${nft.topic_id}`);
            // Create a placeholder element first
            const nftElement = document.createElement('div');
            nftElement.className = 'nft-item';
            nftElement.dataset.serial = nft.serial_number;
            nftElement.dataset.tokenId = nft.token_id;
            nftElement.dataset.hashinal = 'true';
            nftElement.dataset.topicId = nft.topic_id;
            
            nftElement.innerHTML = `
              <div class="loading-placeholder">Loading Hashinal...</div>
              <p>Hashinal #${nft.serial_number}</p>
            `;
            
            nftList.appendChild(nftElement);
            
            // Fetch the image URL asynchronously
            getHashinalImageUrl(nft.topic_id).then(imgUrl => {
              // Update the element with the image once we have it
              nftElement.innerHTML = `
                <img 
                  src="${imgUrl}" 
                  alt="Hashinal #${nft.serial_number}" 
                  crossorigin="anonymous"
                  onerror="
                    console.error('Failed to load Hashinal image:', this.src);
                    this.onerror=null; 
                    this.src='${ERROR_PLACEHOLDER}';
                  " 
                  onclick="selectNFT(this)">
                <p>Hashinal #${nft.serial_number}</p>
                <small class="topic-id">${nft.topic_id}</small>
              `;
            });
            
            hashinalProcessed++;
            processedCount++;
            continue; // Skip the rest of the loop for this item
          }
          // Regular NFT with metadata
          else if (nft.metadata) {
            try {
              // Decode the base64 metadata
              const metadataStr = atob(nft.metadata);
              
              // Check again for HCS metadata (in case we missed it in the first pass)
              if (metadataStr.startsWith('hcs://')) {
                const topicId = metadataStr.replace('hcs://', '');
                console.log(`Found HCS token with topic_id: ${topicId}`);
                imageUrl = getHashinalImageUrl(topicId);
                nftName = `Hashinal #${nft.serial_number}`;
                console.log(`Set Hashinal image URL to: ${imageUrl}`);
                isHashinal = true;
                hashinalProcessed++;
              }
              // Handle different metadata formats
              else if (metadataStr.startsWith('ipfs://')) {
                try {
                  const metadata = await loadFromIPFS(metadataStr);
                  if (metadata.image) {
                    if (metadata.image.startsWith('ipfs://')) {
                      imageUrl = await getImageUrlFromIPFS(metadata.image);
                    } else {
                      // Ensure the URL is properly encoded
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
                // Try parsing as JSON
                try {
                  const metadata = JSON.parse(metadataStr);
                  if (metadata.image) {
                    if (metadata.image.startsWith('ipfs://')) {
                      imageUrl = await getImageUrlFromIPFS(metadata.image);
                    } else {
                      // Handle URLs with special characters
                      imageUrl = encodeImageUrl(metadata.image);
                    }
                  } else if (metadata.media) {
                    // Some NFTs use 'media' instead of 'image'
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
                  // Not JSON, might be a direct URL
                  if (metadataStr.startsWith('http')) {
                    imageUrl = encodeImageUrl(metadataStr);
                  }
                }
              }
            } catch (e) {
              console.error(`Error processing metadata: ${e.message}`);
            }
          }
          
          // Create NFT element with additional data attributes for debugging
          const nftElement = document.createElement('div');
          nftElement.className = 'nft-item';
          nftElement.dataset.serial = nft.serial_number;
          nftElement.dataset.tokenId = nft.token_id;
          if (isHashinal) {
            nftElement.dataset.hashinal = 'true';
            nftElement.dataset.topicId = nft.topic_id;
          }
          
          // Only use ERROR_PLACEHOLDER as fallback if image loading fails
          if (isHashinal) {
            nftElement.innerHTML = `
              <img 
                src="${imageUrl}" 
                alt="${nftName}" 
                crossorigin="anonymous"
                onerror="
                  console.error('Failed to load Hashinal image:', this.src);
                  this.onerror=null; 
                  this.src='${ERROR_PLACEHOLDER}';
                " 
                onclick="selectNFT(this)">
              <p>${nftName}</p>
              <small class="topic-id">${nft.topic_id}</small>
            `;
          } else {
            nftElement.innerHTML = `
              <img src="${imageUrl}" alt="${nftName}" onerror="this.onerror=null; this.src='${ERROR_PLACEHOLDER}';" onclick="selectNFT(this)">
              <p>${nftName}</p>
            `;
          }
          
          nftList.appendChild(nftElement);
          processedCount++;
          
        } catch (error) {
          console.error(`Error processing NFT ${nft.token_id}#${nft.serial_number}:`, error);
          processedCount++;
        }
      }
      
      // Update progress
      if (processedCount < totalNFTs) {
        // Process next batch
        setTimeout(() => processBatch(endIndex), 10);
      } else {
        console.log(`Finished loading all ${processedCount} NFTs, including ${hashinalProcessed} Hashinals`);
      }
    }
    
    // Start processing the first batch
    processBatch(0);
  }

  // Select NFT for overlay
  window.selectNFT = function (img) {
    console.log('NFT selected:', img.src);
    selectedNFT = img.src;
    document.querySelectorAll('.nft-item').forEach(item => item.classList.remove('selected'));
    img.parentElement.classList.add('selected');
    const canvasPlaceholder = document.getElementById('nft-display')?.querySelector('.canvas-placeholder');
    if (canvasPlaceholder) canvasPlaceholder.style.display = 'none';
    
    // Draw NFT background
    drawNFTBackground();
    
    // Check if there's already an overlay image selected
    const overlayImg = document.getElementById('overlay-img');
    if (overlayImg && overlayImg.src && overlayImg.src !== window.location.href) {
      updateOverlayImage(overlayImg.src);
    }
  };

  // Start WalletConnect initialization
  initializeWalletConnect();
});

// Add this function to create a mobile-friendly image share modal
function showImageShareModal(imageDataURL) {
  // Create modal container
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
  
  // Create image element
  const imageElement = document.createElement('img');
  imageElement.src = imageDataURL;
  imageElement.style.maxWidth = '90%';
  imageElement.style.maxHeight = '70%';
  imageElement.style.objectFit = 'contain';
  imageElement.style.borderRadius = '8px';
  imageElement.style.marginBottom = '20px';
  
  // Create save button
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save to Photos';
  saveButton.className = 'btn';
  saveButton.style.marginBottom = '10px';
  saveButton.addEventListener('click', () => {
    // Create an invisible link and click it
    const link = document.createElement('a');
    link.href = imageDataURL;
    link.download = 'overlayz-nft.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.className = 'btn';
  closeButton.style.marginTop = '10px';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modalContainer);
  });
  
  // Add elements to modal
  modalContainer.appendChild(imageElement);
  modalContainer.appendChild(saveButton);
  modalContainer.appendChild(closeButton);
  
  // Add modal to body
  document.body.appendChild(modalContainer);
  
  // Also add tap to close
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      document.body.removeChild(modalContainer);
    }
  });
}

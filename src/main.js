import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { LedgerId } from '@hashgraph/sdk';
import Konva from 'konva';

let dAppConnector;
let stage, layer, overlayImage, transformer;
let selectedNFT = null;
let backgroundImage = null;
let currentNFTPage = 1;
const nftsPerPage = 10; // Show 10 NFTs initially
let allNFTs = [];
let isLoadingMoreNFTs = false;

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
                  
                  // Create download link
                  const link = document.createElement('a');
                  link.href = dataURL;
                  link.download = 'overlayed-nft.png';
                  link.click();
                  console.log('Download initiated at full resolution');
                  
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
                
                // Create download link
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = 'nft.png';
                link.click();
                
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
      
      // Fetch all NFTs first
      const response = await fetch(`https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts`);
      const data = await response.json();
      allNFTs = data.nfts || [];
      
      // Display first page
      displayNFTPage(1);
    } catch (error) {
      console.error('NFT fetch error:', error);
      const nftList = document.getElementById('nft-list');
      if (nftList) nftList.innerHTML = '<p class="nft-placeholder">Error fetching NFTs</p>';
    }
  }

  // New function to display a specific page of NFTs
  async function displayNFTPage(page) {
    const nftList = document.getElementById('nft-list');
    if (!nftList) return;
    
    isLoadingMoreNFTs = true;
    
    // Calculate start and end indices
    const startIdx = (page - 1) * nftsPerPage;
    const endIdx = Math.min(startIdx + nftsPerPage, allNFTs.length);
    
    // Get NFTs for this page
    const pageNFTs = allNFTs.slice(startIdx, endIdx);
    
    // If it's the first page, replace content
    if (page === 1) {
      nftList.innerHTML = '';
    } else {
      // Remove load more button if it exists
      const existingLoadMoreBtn = document.getElementById('load-more-nfts');
      if (existingLoadMoreBtn) {
        existingLoadMoreBtn.remove();
      }
    }
    
    // Process and display NFTs
    const nftElements = await Promise.all(pageNFTs.map(async nft => {
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
          <img src="${imageUrl}" alt="NFT" onerror="this.src='https://via.placeholder.com/150?text=NFT'" onclick="selectNFT(this)">
          <p>Serial: ${nft.serial_number}</p>
        </div>
      `;
    }));
    
    // Append new NFTs to the list
    nftList.innerHTML += nftElements.join('');
    
    // Update current page
    currentNFTPage = page;
    
    // Add "Load More" button if there are more NFTs
    if (endIdx < allNFTs.length) {
      // Create button container div
      const loadMoreContainer = document.createElement('div');
      loadMoreContainer.style.width = '100%';
      loadMoreContainer.style.textAlign = 'center';
      loadMoreContainer.style.margin = '20px 0';
      loadMoreContainer.style.gridColumn = '1 / -1'; // Span all columns
      
      // Create button that matches your existing button style
      const loadMoreButton = document.createElement('button');
      loadMoreButton.id = 'load-more-nfts';
      loadMoreButton.className = 'btn'; // Use your existing button class
      loadMoreButton.textContent = 'Load More';
      
      // Add click event
      loadMoreButton.addEventListener('click', () => {
        if (!isLoadingMoreNFTs) {
          displayNFTPage(currentNFTPage + 1);
        }
      });
      
      // Add button to container
      loadMoreContainer.appendChild(loadMoreButton);
      
      // Add container to NFT list
      nftList.appendChild(loadMoreContainer);
    }
    
    isLoadingMoreNFTs = false;
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

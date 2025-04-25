import { HederaWalletConnect } from "@hashgraph/hedera-wallet-connect";

// Initialize WalletConnect client
let walletConnectClient;

const connectWallet = async () => {
    console.log("Attempting automatic wallet connection...");
    try {
        walletConnectClient = await HederaWalletConnect.init({
            projectId: "YOUR_PROJECT_ID", // Replace with your WalletConnect Project ID
            metadata: {
                name: "Overlayz",
                description: "NFT Overlay Tool for Hedera",
                url: "http://localhost:5173",
                icons: ["https://via.placeholder.com/150?text=Overlayz"],
            },
            network: "testnet", // Use "mainnet" for production
            // Configure WalletConnect for deep linking
            walletConnectOptions: {
                requiredNamespaces: {
                    hedera: {
                        methods: [
                            "hedera_getAccountBalance",
                            "hedera_sign",
                            "hedera_signTransaction"
                        ],
                        chains: ["hedera:testnet"],
                        events: [],
                    },
                },
            },
        });
        console.log("WalletConnect initialized successfully:", walletConnectClient);

        // Automatically connect on page load
        const session = await walletConnectClient.connect();
        console.log("Wallet connection successful, session:", session);

        // Get the connected account
        const accountId = session.namespaces.hedera.accounts[0].split(":").pop();
        console.log("Connected to wallet:", accountId);

        // Update UI
        document.getElementById("wallet-status").textContent = `Connected: ${accountId}`;
        document.getElementById("connect-wallet").textContent = "Disconnect Wallet";
        document.getElementById("connect-wallet").classList.add("connected");
    } catch (error) {
        console.error("Wallet connection error:", error);
        alert("Failed to connect wallet: " + error.message);
    }
};

// Disconnect Wallet
const disconnectWallet = async () => {
    console.log("Disconnect Wallet button clicked!");
    try {
        if (walletConnectClient) {
            await walletConnectClient.disconnect();
            walletConnectClient = null;
            console.log("Wallet disconnected successfully");

            // Reset UI
            document.getElementById("wallet-status").textContent = "Wallet not connected";
            document.getElementById("connect-wallet").textContent = "Connect Wallet";
            document.getElementById("connect-wallet").classList.remove("connected");
        }
    } catch (error) {
        console.error("Wallet disconnection error:", error);
        alert("Failed to disconnect wallet: " + error.message);
    }
};

// Event listener for manual disconnection
document.getElementById("connect-wallet").addEventListener("click", () => {
    const button = document.getElementById("connect-wallet");
    if (button.classList.contains("connected")) {
        disconnectWallet();
    }
});

// Automatically connect on page load
connectWallet();

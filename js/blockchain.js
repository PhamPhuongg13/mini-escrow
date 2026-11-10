/**
 * Blockchain learning boundary
 * ----------------------------
 * This file intentionally contains no ethers.js imports, provider calls,
 * contract reads, or transactions. Implement each TODO in order. Keep the
 * exported function names unchanged so app.js can continue to call them.
 */

function blockchainTodo(id, functionName) {
  const error = new Error(`Blockchain integration not implemented yet: ${id}`);
  error.code = id;
  error.functionName = functionName;
  throw error;
}

let contract = null;
let provider = null;
let signer = null;
let address = null;
let network = null;

async function connectWallet() {
  if (!window.ethereum) {
    alert("Vui lòng cài đặt MetaMask!");
    return;
  }

  try {
    await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    provider = new ethers.BrowserProvider(window.ethereum); // Tạo đối tượng provider
    signer = await provider.getSigner(); // Lấy đối tượng Signer
    address = await signer.getAddress(); // Lấy address
    network = await provider.getNetwork();

    console.log("Địa chỉ ví:", address);

    const chainId = await checkNetwork();

    if (chainId === APP_CONFIG.FUJI.chainId) {
      await initializeContract();
      const escrowData = await loadEscrowData();
      console.log("Escrow data:", escrowData);
      window.MiniEscrowUI.updateEscrowData(escrowData);
    }

    return {
      address,
      chainId,
    };
  } catch (error) {
    console.error("Không thể kết nối ví:", error);
  }
}

// TODO [BLOCKCHAIN-02]
// Goal: read the active wallet network and verify chainId 43113 (Fuji).
// Learn/use: provider.getNetwork(); remember ethers v6 returns chainId as bigint.
// Input: the provider you created (or your safely stored module-level provider).
// Output: the real numeric chain ID and/or a boolean indicating Fuji.
// UI state: update state.chainId and allow app.js to render the wrong-network UI.
// Avoid: comparing bigint to a string, silently switching networks, or marking
// Fuji active before the provider confirms it.
async function checkNetwork() {
  network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId === APP_CONFIG.FUJI.chainId) {
    console.log("Đã kết nối Avalanche Fuji");
  } else {
    console.log("Sai mạng, hãy chuyển sang Avalanche Fuji");
  }

  return chainId;
}

// TODO [BLOCKCHAIN-03]
// Goal: construct the MiniEscrow contract instance after wallet/network checks.
// Learn/use: new ethers.Contract(APP_CONFIG.CONTRACT_ADDRESS,
// APP_CONFIG.CONTRACT_ABI, signer).
// Input: a valid address, compiled ABI, and signer. Output: contract instance.
// UI state: no escrow values change here; retain the instance for later calls.
// Avoid: using an empty/invalid address, the wrong ABI/network, or a provider
// when a signer is required for write functions.
async function initializeContract() {
  // Kiểm tra số dư
  const balance = await provider.getBalance(address);
  console.log("Số dư:", ethers.formatEther(balance), "AVAX");

  // Tạo đối tượng contract để tác động nó
  contract = new ethers.Contract(
    APP_CONFIG.CONTRACT_ADDRESS,
    APP_CONFIG.CONTRACT_ABI,
    signer,
  );

  return contract;
}

// TODO [BLOCKCHAIN-04]
// Goal: read buyer(), seller(), amount(), status(), and refundApproved().
// Learn/use: contract view calls and ethers.formatEther(amount). Map Solidity
// enum values exactly: 0 Created, 1 Funded, 2 Released, 3 Refunded.
// Input: initialized contract. Output: { buyer, seller, amount, status,
// refundApproved } containing real, UI-friendly values.
// UI state: pass the result to updateEscrowData() in app.js, then re-render.
// Avoid: losing bigint precision, displaying wei as AVAX, guessing enum values,
// or replacing a failed read with mock data.
async function loadEscrowData() {
  if (!contract) {
    throw new Error("Vui lòng kết nối ví trước!");
  }

  const buyer = await contract.buyer();
  const seller = await contract.seller();
  const amount = await contract.amount();
  const status = await contract.status();
  const refundApproved = await contract.refundApproved();

  const statuses = ["Created", "Funded", "Released", "Refunded"];

  return {
    buyer,
    seller,
    amount: ethers.formatEther(amount),
    status: statuses[Number(status)],
    refundApproved,
  };
}

// TODO [BLOCKCHAIN-05]
// Goal: call the payable contract.deposit() as the buyer.
// Learn/use: ethers.parseEther(amount), contract.deposit({ value }), and tx.wait().
// Input: validated decimal AVAX string. Output: the confirmed transaction receipt.
// UI state: app.js already sets pending UI; after confirmation, reload escrow data
// and only then show a real success notification.
// Avoid: JavaScript floating-point conversion, sending zero/negative amounts,
// duplicate submits, calling as the seller, or claiming success before tx.wait().
async function depositAVAX(amount) {
  if (!contract) {
    throw new Error("Vui lòng kết nối ví trước!");
  }

  const tx = await contract.deposit({ value: ethers.parseEther(amount) });
  const receipt = await tx.wait();

  const escrowData = await loadEscrowData();
  window.MiniEscrowUI.updateEscrowData(escrowData);
  console.log("Deposit thành công!", receipt);

  return receipt;
}

// TODO [BLOCKCHAIN-06]
// Goal: call contract.releasePayment() as the buyer when status is Funded.
// Learn/use: contract write calls and tx.wait().
// Input: none. Output: confirmed transaction receipt.
// UI state: keep pendingTransaction current, then reload escrow data and display
// confirmation only after mining.
// Avoid: enabling for non-buyers/wrong status or assuming submission equals finality.
async function releasePayment() {
  if (!contract) {
    throw new Error("Vui lòng kết nối ví trước!");
  }

  const tx = await contract.releasePayment();
  const receipt = await tx.wait();

  const escrowData = await loadEscrowData();
  window.MiniEscrowUI.updateEscrowData(escrowData);
  console.log("Release thành công!", receipt);

  return receipt;
}

// TODO [BLOCKCHAIN-07]
// Goal: call contract.approveRefund() as the seller while escrow is Funded.
// Learn/use: contract write calls and tx.wait().
// Input: none. Output: confirmed receipt; the on-chain refundApproved becomes true.
// UI state: reload data so the buyer's Refund button reflects the real approval.
// Avoid: changing local approval before confirmation or allowing the buyer to call it.
async function approveRefund() {
  if (!contract) {
    throw new Error("Vui lòng kết nối ví trước!");
  }

  const tx = await contract.approveRefund();
  const receipt = await tx.wait();

  const escrowData = await loadEscrowData();
  window.MiniEscrowUI.updateEscrowData(escrowData);
  console.log("Approve refund thành công!", receipt);

  return receipt;
}

// TODO [BLOCKCHAIN-08]
// Goal: call contract.refund() as buyer, only after seller approval.
// Learn/use: contract write calls and tx.wait().
// Input: none. Output: confirmed receipt and refreshed Refunded contract state.
// UI state: reload escrow data, clear pending state, and show real confirmation.
// Avoid: refunding before approval, calling as seller, or displaying a fake hash.
async function refundPayment() {
  if (!contract) {
    throw new Error("Vui lòng kết nối ví trước!");
  }

  const tx = await contract.refund();
  const receipt = await tx.wait();

  const escrowData = await loadEscrowData();
  window.MiniEscrowUI.updateEscrowData(escrowData);
  console.log("refund thành công!", receipt);

  return receipt;
}

// TODO [BLOCKCHAIN-09]
// Goal: respond to MetaMask's accountsChanged event.
// Learn/use: window.ethereum.on("accountsChanged", handleAccountsChanged).
// Input: accounts array. Output: none; empty means disconnected.
// UI state: update/reset wallet address and connection state, then reload escrow
// data for a real new account. Avoid retaining the prior user's role or values.
async function handleAccountsChanged(accounts) {
  // 1. Người dùng ngắt kết nối
  if (accounts.length === 0) {
    address = null;
    signer = null;
    contract = null;

    window.MiniEscrowUI.updateWalletState({
      address: null,
      chainId: null,
    });

    window.MiniEscrowUI.resetEscrowData();
    return;
  }

  // 2. Người dùng đổi sang tài khoản khác
  try {
    if (!provider) {
      provider = new ethers.BrowserProvider(window.ethereum);
    }

    signer = await provider.getSigner(accounts[0]);
    address = await signer.getAddress();

    const chainId = Number((await provider.getNetwork()).chainId);
    network = await provider.getNetwork();

    contract = null;
    window.MiniEscrowUI.resetEscrowData();

    window.MiniEscrowUI.updateWalletState({
      address,
      chainId,
    });

    // 3. Khởi tạo lại contract với signer mới
    if (chainId === APP_CONFIG.FUJI.chainId) {
      await initializeContract();

      // 4. Tải lại dữ liệu từ blockchain
      const escrowData = await loadEscrowData();
      window.MiniEscrowUI.updateEscrowData(escrowData);
    }
  } catch (error) {
    console.error("Lỗi khi đổi tài khoản:", error);
  }
}

// TODO [BLOCKCHAIN-10]
// Goal: respond to MetaMask's chainChanged event and re-check the network.
// Learn/use: window.ethereum.on("chainChanged", handleChainChanged) and parse the
// hexadecimal chain ID supplied by the wallet.
// Input: chainId hex string. Output: none.
// UI state: update chainId, clear stale contract data, initialize/load only on Fuji.
// Avoid: treating hex "0xa869" as decimal or keeping data from another network.
async function handleChainChanged(chainId) {
  const newChainId = Number(chainId);
  contract = null;
  signer = null;
  provider = null;
  network = null;

  window.MiniEscrowUI.updateWalletState({
    address,
    chainId: newChainId,
  });

  window.MiniEscrowUI.resetEscrowData();

  // Chỉ khởi tạo contract trên Avalanche Fuji
  if (newChainId === APP_CONFIG.FUJI.chainId && address) {
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner(address);
      network = await provider.getNetwork();

      await initializeContract();

      const escrowData = await loadEscrowData();
      window.MiniEscrowUI.updateEscrowData(escrowData);
    } catch (error) {
      console.error("Lỗi khi chuyển mạng:", error);
    }
  }
}

window.MiniEscrowBlockchain = Object.freeze({
  connectWallet,
  checkNetwork,
  initializeContract,
  loadEscrowData,
  depositAVAX,
  releasePayment,
  approveRefund,
  refundPayment,
  handleAccountsChanged,
  handleChainChanged,
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", handleAccountsChanged);
}

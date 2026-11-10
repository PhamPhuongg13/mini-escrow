const state = {
  walletAddress: null,
  chainId: null,
  isConnected: false,
  isLoading: false,
  escrow: { buyer: null, seller: null, amount: null, status: null, refundApproved: null },
  pendingTransaction: null,
  error: null
};

const $ = (selector) => document.querySelector(selector);
const elements = {};
let modalConfirmHandler = null;

document.addEventListener("DOMContentLoaded", () => {
  Object.assign(elements, {
    connect: $("#connectWalletButton"), network: $("#networkPill"), walletStatus: $("#walletStatusText"), walletRole: $("#walletRoleText"),
    status: $("#escrowStatusBadge"), amount: $("#escrowAmount"), caption: $("#amountCaption"), buyer: $("#buyerAddress"), seller: $("#sellerAddress"), approval: $("#refundApproval"), contract: $("#contractAddress"), explorer: $("#explorerLink"),
    timeline: $("#escrowTimeline"), depositForm: $("#depositForm"), depositInput: $("#depositAmount"), depositMessage: $("#depositMessage"), depositButton: $("#depositButton"), releaseButton: $("#releaseButton"), releaseSeller: $("#releaseSeller"), releaseAmount: $("#releaseAmount"), approveButton: $("#approveRefundButton"), refundButton: $("#refundButton"), refundCardStatus: $("#refundCardStatus"), approvalIndicator: $("#approvalIndicator"),
    modal: $("#modalBackdrop"), modalTitle: $("#modalTitle"), modalMessage: $("#modalMessage"), modalNote: $("#modalNote"), modalConfirm: $("#modalConfirm"), toastRegion: $("#toastRegion")
  });
  bindEvents();
  renderDashboard();
  lucide.createIcons();
});

function bindEvents() {
  elements.connect.addEventListener("click", () => runBlockchainAction("Connect wallet", () => MiniEscrowBlockchain.connectWallet()));
  elements.depositInput.addEventListener("input", validateDeposit);
  elements.depositForm.addEventListener("submit", (event) => { event.preventDefault(); if (!validateDeposit()) return; runBlockchainAction("Deposit", () => MiniEscrowBlockchain.depositAVAX(elements.depositInput.value.trim())); });
  elements.releaseButton.addEventListener("click", () => showConfirmationModal({title:"Release payment?",message:"This will send the full escrow balance to the seller. This action cannot be reversed.",confirmLabel:"Release payment",onConfirm:() => runBlockchainAction("Release payment", () => MiniEscrowBlockchain.releasePayment())}));
  elements.approveButton.addEventListener("click", () => showConfirmationModal({title:"Approve buyer refund?",message:"Your approval allows the buyer to return the secured funds. It does not execute the refund itself.",confirmLabel:"Approve refund",onConfirm:() => runBlockchainAction("Approve refund", () => MiniEscrowBlockchain.approveRefund())}));
  elements.refundButton.addEventListener("click", () => showConfirmationModal({title:"Refund the escrow?",message:"The full secured amount will be returned to the buyer after wallet confirmation.",confirmLabel:"Refund buyer",onConfirm:() => runBlockchainAction("Refund", () => MiniEscrowBlockchain.refundPayment())}));
  $("#modalClose").addEventListener("click", closeModal); $("#modalCancel").addEventListener("click", closeModal);
  elements.modal.addEventListener("click", (event) => { if (event.target === elements.modal) closeModal(); });
  elements.modalConfirm.addEventListener("click", () => { const handler = modalConfirmHandler; closeModal(); if (handler) handler(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !elements.modal.hidden) closeModal(); });
}

function roleFor(address = state.walletAddress, escrow = state.escrow) {
  if (!state.isConnected || !address) return "visitor";
  const current = address.toLowerCase();
  if (escrow.buyer && current === escrow.buyer.toLowerCase()) return "buyer";
  if (escrow.seller && current === escrow.seller.toLowerCase()) return "seller";
  return "observer";
}

function renderDashboard() {
  renderWalletStatus(); renderEscrowOverview(); renderEscrowTimeline(); updateActionButtons();
}

function renderWalletStatus() {
  const correctNetwork = state.chainId === APP_CONFIG.FUJI.chainId;
  const role = roleFor();
  elements.connect.querySelector("span").textContent = state.isConnected ? shortenAddress(state.walletAddress) : "Connect wallet";
  elements.walletStatus.textContent = state.isConnected ? shortenAddress(state.walletAddress, 6) : "Not connected";
  elements.walletRole.textContent = state.isConnected ? ({buyer:"Connected as buyer",seller:"Connected as seller",observer:"Connected · No escrow role"}[role]) : "Connect to identify your role";
  elements.network.classList.toggle("wrong", state.isConnected && !correctNetwork);
  elements.network.querySelector("span:last-child").textContent = state.isConnected && !correctNetwork ? "Wrong network" : "Fuji Testnet";
}

function renderEscrowOverview() {
  const escrow = state.escrow; const status = escrow.status;
  elements.amount.textContent = escrow.amount ?? "—"; elements.caption.textContent = escrow.amount == null ? "Connect your wallet to load the contract" : "Held securely by the MiniEscrow contract";
  elements.buyer.textContent = escrow.buyer ? shortenAddress(escrow.buyer, 7) : "—"; elements.buyer.title = escrow.buyer || "";
  elements.seller.textContent = escrow.seller ? shortenAddress(escrow.seller, 7) : "—"; elements.seller.title = escrow.seller || "";
  elements.approval.textContent = escrow.refundApproved == null ? "—" : escrow.refundApproved ? "Approved" : "Not approved";
  elements.status.querySelector("b").textContent = status || "Awaiting data"; elements.status.className = `status-badge ${["Released","Refunded"].includes(status) ? "success" : status ? "active" : "neutral"}`;
  elements.releaseSeller.textContent = escrow.seller ? shortenAddress(escrow.seller, 6) : "—"; elements.releaseAmount.textContent = `${escrow.amount ?? "—"} AVAX`;
  elements.refundCardStatus.textContent = escrow.refundApproved == null ? "Not loaded" : escrow.refundApproved ? "Approved" : "Awaiting approval";
  const configured = /^0x[a-fA-F0-9]{40}$/.test(APP_CONFIG.CONTRACT_ADDRESS);
  elements.contract.textContent = configured ? shortenAddress(APP_CONFIG.CONTRACT_ADDRESS, 7) : "Not configured"; elements.contract.title = configured ? APP_CONFIG.CONTRACT_ADDRESS : "";
  elements.explorer.classList.toggle("disabled", !configured); elements.explorer.href = configured ? `${APP_CONFIG.FUJI.explorerUrl}/address/${APP_CONFIG.CONTRACT_ADDRESS}` : "#"; elements.explorer.target = configured ? "_blank" : "";
}

function renderEscrowTimeline() {
  const order = ["Created","Funded"]; const status = state.escrow.status; const terminal = ["Released","Refunded"].includes(status);
  elements.timeline.querySelectorAll(".timeline-step").forEach(step => { const name = step.dataset.status; const complete = order.indexOf(name) < order.indexOf(status) || (terminal && order.includes(name)); step.classList.toggle("complete", complete || name === status && terminal); step.classList.toggle("current", name === status && !terminal); });
  elements.timeline.querySelectorAll(".timeline-line").forEach((line,index) => line.classList.toggle("complete", (index === 0 && ["Funded","Released","Refunded"].includes(status)) || (index === 1 && terminal)));
}

function updateActionButtons() {
  const role = roleFor(); const status = state.escrow.status; const ready = state.isConnected && state.chainId === APP_CONFIG.FUJI.chainId && !state.isLoading;
  elements.depositButton.disabled = !(ready && role === "buyer" && status === "Created" && Number(elements.depositInput.value) > 0);
  elements.releaseButton.disabled = !(ready && role === "buyer" && status === "Funded");
  elements.approveButton.disabled = !(ready && role === "seller" && status === "Funded" && state.escrow.refundApproved === false);
  elements.refundButton.disabled = !(ready && role === "buyer" && status === "Funded" && state.escrow.refundApproved === true);
}

function validateDeposit() {
  const value = elements.depositInput.value.trim(); const valid = value !== "" && Number.isFinite(Number(value)) && Number(value) > 0;
  elements.depositMessage.textContent = value && !valid ? "Enter an amount greater than zero." : ""; updateActionButtons(); return valid;
}

async function runBlockchainAction(label, action) {
  if (state.isLoading) return; showLoading(label);
  try {
    const result = await action();
    // A future implementation may return real wallet or escrow data. We only
    // apply values actually returned by blockchain.js; nothing is fabricated.
    if (label === "Connect wallet" && result) updateWalletState(result);
    showToast(`${label} confirmed.`, "success");
  } catch (error) {
    state.error = error;
    if (error && /^BLOCKCHAIN-\d+$/.test(error.code || "")) showToast(error.message, "info");
    else showToast(getReadableError(error), "error");
  } finally { hideLoading(); }
}

function showLoading(action) { state.isLoading = true; state.pendingTransaction = action; updateActionButtons(); showToast(`${action}: waiting for wallet or network response…`, "pending", 2600); }
function hideLoading() { state.isLoading = false; state.pendingTransaction = null; updateActionButtons(); }

function showToast(message, type = "info", duration = 4500) {
  const icons = {info:"info",success:"circle-check",error:"circle-x",pending:"loader-circle"}; const toast = document.createElement("div"); toast.className = `toast ${type}`; toast.innerHTML = `<i data-lucide="${icons[type] || icons.info}"></i><div>${escapeHtml(message)}</div>`; elements.toastRegion.appendChild(toast); lucide.createIcons({nodes:[toast]}); setTimeout(() => toast.remove(), duration);
}

function showConfirmationModal({title,message,note="This action will require confirmation in your wallet.",confirmLabel="Confirm",onConfirm}) { elements.modalTitle.textContent=title; elements.modalMessage.textContent=message; elements.modalNote.textContent=note; elements.modalConfirm.textContent=confirmLabel; modalConfirmHandler=onConfirm; elements.modal.hidden=false; document.body.style.overflow="hidden"; elements.modalConfirm.focus(); }
function closeModal() { elements.modal.hidden=true; document.body.style.overflow=""; modalConfirmHandler=null; }
function updateWalletState({address,chainId}) { state.walletAddress=address || null; state.chainId=Number(chainId); state.isConnected=Boolean(address); renderDashboard(); }
function updateEscrowData(realEscrowData) { state.escrow={...state.escrow,...realEscrowData}; renderDashboard(); }
function resetEscrowData() { state.escrow={buyer:null,seller:null,amount:null,status:null,refundApproved:null}; renderDashboard(); }
function shortenAddress(address,size=4) { return address ? `${address.slice(0,size+2)}…${address.slice(-size)}` : "—"; }
function getReadableError(error) { const message=error?.shortMessage || error?.reason || error?.message || "The request failed."; if (/rejected|denied/i.test(message)) return "Transaction rejected in wallet."; if (/revert/i.test(message)) return `Contract call reverted: ${message}`; return message; }
function escapeHtml(value) { const div=document.createElement("div"); div.textContent=String(value); return div.innerHTML; }

// Public bridge for your future blockchain implementation. Call these only with
// values that were actually read from the connected wallet/contract.
window.MiniEscrowUI = Object.freeze({state,renderDashboard,renderWalletStatus,renderEscrowTimeline,updateActionButtons,showToast,showLoading,hideLoading,showConfirmationModal,updateWalletState,updateEscrowData,resetEscrowData});

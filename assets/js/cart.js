/**
 * Sistema de Carrinho de Compras
 * Gerencia adição, remoção e persistência de itens no carrinho
 */

class ShoppingCart {
    constructor() {
        this.cart = this.loadCart();
        this.init();
    }

    init() {
        this.updateCartCount();
        this.bindEvents();
    }

    bindEvents() {
        // Fechar modal ao clicar fora
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('cartModal');
            if (event.target === modal) {
                this.toggleCart();
            }
        });

        // Fechar modal com ESC
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const modal = document.getElementById('cartModal');
                if (modal && modal.style.display === 'block') {
                    this.toggleCart();
                }
            }
        });
    }

    loadCart() {
        try {
            const savedCart = localStorage.getItem('cart');
            return savedCart ? JSON.parse(savedCart) : [];
        } catch (error) {
            console.error('Erro ao carregar carrinho:', error);
            return [];
        }
    }

    saveCart() {
        try {
            localStorage.setItem('cart', JSON.stringify(this.cart));
        } catch (error) {
            console.error('Erro ao salvar carrinho:', error);
        }
    }

    addItem(product, quantity = 1) {
        if (!product || !product.id) {
            console.error('Produto inválido:', product);
            return false;
        }

        const existingItem = this.cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: parseFloat(product.price),
                quantity: quantity,
                image: product.image || 'assets/images/placeholder.jpg'
            });
        }

        this.saveCart();
        this.updateCartCount();
        return true;
    }

    removeItem(index) {
        if (index >= 0 && index < this.cart.length) {
            this.cart.splice(index, 1);
            this.saveCart();
            this.updateCartCount();
            return true;
        }
        return false;
    }

    updateQuantity(index, quantity) {
        if (index >= 0 && index < this.cart.length && quantity > 0) {
            this.cart[index].quantity = quantity;
            this.saveCart();
            this.updateCartCount();
            return true;
        }
        return false;
    }

    clearCart() {
        this.cart = [];
        this.saveCart();
        this.updateCartCount();
    }

    getTotal() {
        return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    getItemCount() {
        return this.cart.reduce((count, item) => count + item.quantity, 0);
    }

    updateCartCount() {
        const cartCountElements = document.querySelectorAll('.cart-count, #cartCount');
        const count = this.getItemCount();
        
        cartCountElements.forEach(element => {
            if (element) {
                element.textContent = count;
                element.style.display = count > 0 ? 'flex' : 'none';
            }
        });
    }

    toggleCart() {
        const modal = document.getElementById('cartModal');
        if (!modal) return;

        if (modal.style.display === 'block') {
            modal.style.display = 'none';
        } else {
            this.displayCartItems();
            modal.style.display = 'block';
        }
    }

    displayCartItems() {
        const cartItemsContainer = document.getElementById('cartItems');
        const cartTotalElement = document.getElementById('cartTotal');
        
        if (!cartItemsContainer || !cartTotalElement) return;

        if (this.cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="empty-state">
                    <p>Seu carrinho está vazio</p>
                    <button class="btn btn-primary mt-3" onclick="cart.toggleCart()">
                        Continuar Comprando
                    </button>
                </div>
            `;
            cartTotalElement.textContent = 'Total: R$ 0,00';
            return;
        }

        let total = 0;
        cartItemsContainer.innerHTML = '';

        this.cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${this.escapeHtml(item.name)}</div>
                    <div class="cart-item-price">
                        R$ ${this.formatPrice(item.price)} x ${item.quantity} = R$ ${this.formatPrice(itemTotal)}
                    </div>
                </div>
                <div class="cart-item-actions">
                    <div class="quantity-controls mb-2">
                        <button class="btn btn-small" onclick="cart.changeQuantity(${index}, -1)">-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="btn btn-small" onclick="cart.changeQuantity(${index}, 1)">+</button>
                    </div>
                    <button class="btn btn-danger btn-small" onclick="cart.removeItem(${index})">
                        Remover
                    </button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItem);
        });

        cartTotalElement.textContent = `Total: R$ ${this.formatPrice(total)}`;
    }

    changeQuantity(index, delta) {
        if (index >= 0 && index < this.cart.length) {
            const newQuantity = this.cart[index].quantity + delta;
            if (newQuantity > 0) {
                this.updateQuantity(index, newQuantity);
                this.displayCartItems();
            } else {
                this.removeItem(index);
                this.displayCartItems();
            }
        }
    }

    formatPrice(price) {
        return parseFloat(price).toFixed(2).replace('.', ',');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Método para checkout
    async proceedToCheckout(backendUrl) {
        if (this.cart.length === 0) {
            this.showNotification('Seu carrinho está vazio!', 'warning');
            return;
        }

        try {
            // Coletar dados do cliente
            const customerData = await this.collectCustomerData();
            if (!customerData) return;

            // Preparar dados do pedido
            const orderData = {
                items: this.cart.map(item => ({
                    id: item.id,
                    title: item.name,
                    quantity: item.quantity,
                    unit_price: item.price
                })),
                payer: customerData
            };

            // Enviar para o backend
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'create_preference',
                    data: orderData
                })
            });

            const result = await response.json();

            if (result.success && result.init_point) {
                // Limpar carrinho e redirecionar para pagamento
                this.clearCart();
                window.location.href = result.init_point;
            } else {
                this.showNotification('Erro ao processar pedido: ' + (result.error || 'Erro desconhecido'), 'danger');
            }

        } catch (error) {
            console.error('Erro no checkout:', error);
            this.showNotification('Erro ao processar pedido. Tente novamente.', 'danger');
        }
    }

    async collectCustomerData() {
        return new Promise((resolve) => {
            // Criar modal de checkout
            const modal = this.createCheckoutModal();
            document.body.appendChild(modal);
            modal.style.display = 'block';

            // Configurar eventos do formulário
            const form = modal.querySelector('#checkoutForm');
            const cancelBtn = modal.querySelector('#cancelCheckout');

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const customerData = {
                    email: formData.get('email'),
                    name: formData.get('name'),
                    surname: formData.get('surname') || '',
                    phone: {
                        number: formData.get('phone')
                    }
                };

                // Validar dados
                if (this.validateCustomerData(customerData)) {
                    document.body.removeChild(modal);
                    resolve(customerData);
                }
            });

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
        });
    }

    createCheckoutModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Finalizar Compra</h2>
                </div>
                <form id="checkoutForm">
                    <div class="form-group">
                        <label class="form-label" for="email">E-mail *</label>
                        <input type="email" class="form-control" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="name">Nome *</label>
                        <input type="text" class="form-control" id="name" name="name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="surname">Sobrenome</label>
                        <input type="text" class="form-control" id="surname" name="surname">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="phone">Telefone/WhatsApp *</label>
                        <input type="tel" class="form-control" id="phone" name="phone" required 
                               placeholder="(11) 99999-9999">
                    </div>
                    <div class="d-flex gap-1 mt-4">
                        <button type="button" class="btn btn-secondary" id="cancelCheckout">
                            Cancelar
                        </button>
                        <button type="submit" class="btn btn-primary">
                            Continuar para Pagamento
                        </button>
                    </div>
                </form>
            </div>
        `;
        return modal;
    }

    validateCustomerData(data) {
        if (!data.email || !data.email.includes('@')) {
            this.showNotification('E-mail inválido!', 'danger');
            return false;
        }

        if (!data.name || data.name.length < 2) {
            this.showNotification('Nome deve ter pelo menos 2 caracteres!', 'danger');
            return false;
        }

        if (!data.phone.number || data.phone.number.length < 10) {
            this.showNotification('Telefone inválido!', 'danger');
            return false;
        }

        return true;
    }

    showNotification(message, type = 'info') {
        // Remover notificações existentes
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());

        // Criar nova notificação
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} notification`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remover após 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// Inicializar carrinho global
const cart = new ShoppingCart();

// Funções globais para compatibilidade
function addToCart(product, quantity = 1) {
    return cart.addItem(product, quantity);
}

function removeFromCart(index) {
    cart.removeItem(index);
    cart.displayCartItems();
}

function toggleCart() {
    cart.toggleCart();
}

function proceedToCheckout() {
    const backendUrl = window.BACKEND_URL || 'https://script.google.com/macros/s/SEU_SCRIPT_ID_AQUI/exec';
    cart.proceedToCheckout(backendUrl);
}

// Adicionar estilos CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    .cart-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 0;
        border-bottom: 1px solid #e9ecef;
    }

    .cart-item-info {
        flex: 1;
    }

    .cart-item-name {
        font-weight: bold;
        margin-bottom: 0.5rem;
    }

    .cart-item-price {
        color: #28a745;
        font-size: 0.9rem;
    }

    .cart-item-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.5rem;
    }

    .quantity-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .quantity-display {
        min-width: 30px;
        text-align: center;
        font-weight: bold;
    }

    .cart-count {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #dc3545;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        font-size: 0.7rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
    }

    .cart-btn {
        position: relative;
    }
`;
document.head.appendChild(style);


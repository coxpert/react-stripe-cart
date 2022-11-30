const LOCAL_STORAGE_KEY = 'REACT_CART_STORAGE_KEY';

export interface Address {
    firstName: string
    lastName: string
    country: string
    street: string
    aptNo: string
    city: string
    zip: string
    state: string
    cpfNumber?: string
    email: string
    phoneNumber: string
}

export interface Product {
    [key: string]: any
    pKey: string
    price: number
    variantId: string
    name?: string
}

export interface CartItem<P = Product> {
    product: P,
    quantity: number
    price: number
}

type EventLabels =
    "update" |
    "submit" |
    "rates" |
    "price.tax" |
    "price.shipping" |
    "price.stripeFee" |
    "rate.tax" |
    "rate.shipping"

type EventHandler = (event: Cart, data?: Record<string, any>,) => any

class Cart {
    /**
     * Store Name
     */
    storeName = 'DEFAULT_STORE';

    /**
     *  Order total price
     *  product price + fulfillment
     */
    totalPrice = 0;

    /**
     *  Sum of product prices
     */
    subTotalPrice = 0;

    /**
     *  Total product's quantity
     */
    totalQuantity = 0;

    /**
     *  Total product item
     */
    cartItems: CartItem[] = [];

    /**
     *  Cart has product items
     */
    hasCart = false;

    /**
     *  Tax price + shipping price
     */
    fulfillment = 0;

    /**
     *  Billing Address is completed
     */
    isValidBillingAddress = false;

    /**
     *  Billing Address
     */
    billingAddress: Address | null = null;

    /**
     *  Use different shipping address from billing address
     */
    useDiffShippingAddress = false;

    /**
     *  Shipping Address is completed
     */
    isValidShippingAddress = false;

    /**
     * Shipping address
     */
    shippingAddress: Address | null = null;

    /**
     *  Coupon code
     */
    coupon = '';

    /**
     *  Used coupon code to discount price
     */
    redeemedCoupon = false;

    /**
     *  Shipment data to calculate price
     */
    shipData: Record<string, any> | null = null;

    /**
     * shipping amount (shipping rate from the printful API)
     */
    shippingAmount: number = 0;

    /**
     * Shipping cose including stripe fee. 
     */
    shippingCost: number = 0;

    /**
     * Stripe Checkout Fee
     */
    stripeFee: number = 0;

    /**
     * Additional Fee
     */
    additionalFee: number = 0

    /**
     * tax rate
     */
    taxRate: number = 0;

    /**
     * tax amount
     */
    taxAmount: number = 0;

    /**
     * discounted price by coupon code
     */
    discountedPrice = 0;

    /**
     * Event Handlers
     */
    eventHandlers: {
        [key in EventLabels]?: EventHandler
    } = {};

    // indicates loading status when calculating tax and shipping rates
    isUpdating = false;

    // Stripe fee percent
    stripeFeeRate = 0.049

    // useStripe Fee
    useStripeFee = true

    /**
     * Currency
     */
    currency = 'USD'

    /**
     * Locale
     */
    locale = 'en_US'

    static cartInstance: Cart | null = null;

    constructor(storeName?: string) {
        if (storeName) {
            this.storeName = storeName
        }
        this.isUpdating = false;
    }

    initialize() {
        const oldCartData = localStorage.getItem(this.getKey());
        if (oldCartData) {
            const cartObject = JSON.parse(oldCartData);
            delete cartObject.eventHandlers
            for (const key of Object.keys(cartObject)) {
                // @ts-ignore
                this[key] = cartObject[key];
            }
        } else {
            this.resetCart();
        }
    }

    setStoreName(storeName: string): Cart {
        if (storeName) {
            this.storeName = storeName
            this.save()
        }
        return this
    }

    getCartData(storeName?: string): Cart {
        if (storeName) {
            this.storeName = storeName
            this.initialize()
            return this.saveCartToLocalStorage()
        }
        return JSON.parse(JSON.stringify(this));
    }

    resetCart(): Cart {
        this.totalPrice = 0;
        this.subTotalPrice = 0;
        this.totalQuantity = 0;
        this.cartItems = [];
        this.hasCart = false;
        this.isValidBillingAddress = false;
        this.isValidShippingAddress = false;
        this.billingAddress = {
            country: 'US',
            firstName: '',
            lastName: '',
            street: '',
            aptNo: '',
            city: '',
            zip: '',
            state: '',
            cpfNumber: '',
            email: '',
            phoneNumber: ''
        };
        this.useDiffShippingAddress = false;
        this.shippingAddress = this.billingAddress;
        this.shipData = null;
        this.redeemedCoupon = false;
        this.coupon = '';

        this.fulfillment = 0;
        this.taxAmount = 0;
        this.shippingAmount = 0;
        this.taxRate = 0;
        this.shippingCost = 0;
        this.additionalFee = 0;

        return this
    }

    /**
     * @returns new cart object
     */
    static getCart(storeName?: string): Cart {
        if (!Cart.cartInstance) {
            Cart.cartInstance = new Cart(storeName);
        }
        Cart.cartInstance.initialize()
        return Cart.cartInstance;
    }

    getKey(storeName?: string): string {
        return LOCAL_STORAGE_KEY + '_' + (storeName || this.storeName) + '_CART';
    }

    enableStripeFee(useStripeFee: boolean): Cart {
        this.useStripeFee = useStripeFee;
        this.save();
        return this
    }

    /**
     *  saves cart object to local storage
     */
    save(): Cart {
        const cartData = this.saveCartToLocalStorage()
        this.trigger('update')
        return cartData
    }

    saveCartToLocalStorage(): Cart {
        const cartData = JSON.stringify(this);
        localStorage.setItem(this.getKey(), cartData);
        return JSON.parse(cartData)
    }

    /**
     * Setter for additional Fee
     */
    setAdditionalFee(fee: number) {
        this.additionalFee = fee
    }

    calculateTax(): void {
        if (this.taxRate || this.shippingAmount) {
            if (typeof this.eventHandlers['price.tax'] === 'function') {
                this.eventHandlers['price.tax'](this)
            } else {
                this.taxAmount = 0
                if (this.taxRate) {
                    this.taxAmount = (this.subTotalPrice + this.shippingAmount) * this.taxRate;
                }
            }
        }
    }

    calculateStripeFee(): void {
        if (this.useStripeFee) {
            if (typeof this.eventHandlers['price.stripeFee'] === 'function') {
                this.eventHandlers['price.stripeFee'](this)
            } else {
                if (!this.useStripeFee) {
                    this.stripeFee = 0
                    return
                }
                if (this.stripeFeeRate) {
                    const tempTotal = this.subTotalPrice + this.taxAmount + this.shippingAmount
                    this.stripeFee = (tempTotal + tempTotal * this.stripeFeeRate) * this.stripeFeeRate;
                }
                console.warn("Stripe fee rate is undefined")
                this.stripeFee = 0
            }
        }
    }

    calculateShippingCost(): void {
        if (this.taxRate || this.shippingAmount) {
            if (typeof this.eventHandlers['price.shipping'] === 'function') {
                this.trigger("price.shipping")
            } else {
                this.shippingCost = this.shippingAmount + this.stripeFee;
            }
        }
    }

    /**
     *  calculates total price, subtotal, total quantity
     */
    calculateTotalPrice(): Cart {
        this.subTotalPrice = 0;
        this.totalQuantity = 0;

        for (const cartItem of this.cartItems) {
            this.subTotalPrice += cartItem.product.price * cartItem.quantity;
            this.totalQuantity += cartItem.quantity;
        }

        this.calculateTax();

        this.calculateStripeFee();

        this.calculateShippingCost();

        /*
         * Shipping = Shipment cost + Stripe Free
         * Total = Sub Total + Tax + Shipping
         */
        this.totalPrice = this.subTotalPrice + this.taxAmount + this.shippingCost + this.additionalFee;

        this.taxAmount = Number(this.taxAmount.toFixed(2));
        this.totalPrice = Number(this.totalPrice.toFixed(2));
        return this
    }

    /**
     *  adds a product to cart items, if the product already exists in cart items, just increase quantity
     */
    async addCart(product: Product): Promise<Cart> {
        const cartProductItem = this.cartItems.find(
            item => item.product.variantId === product.variantId,
        );
        if (cartProductItem) {
            cartProductItem.quantity++;
            cartProductItem.price = cartProductItem.product.price * cartProductItem.quantity;
        } else {
            this.cartItems.push({
                product,
                quantity: 1,
                price: product.price,
            });
        }
        this.calculateTotalPrice();
        this.hasCart = true;
        this.save();
        await this.updateTaxAndShipAmount();
        return this
    }

    /**
     * remove a product from the cart items
     * @param {*} product
     */
    async removeCartItem(product: Product): Promise<Cart> {
        const cartProductItemIndex = this.cartItems.findIndex(
            item => item.product.pKey === product.pKey,
        );

        if (cartProductItemIndex > -1) {
            this.cartItems.splice(cartProductItemIndex, 1);
        }

        this.calculateTotalPrice();
        this.hasCart = this.cartItems.length > 0;
        this.save();
        await this.updateTaxAndShipAmount();
        return this
    }

    /**
     * updates the quantity of the product from the cart items
     * If the amount is zero, the product will be removed from the cart list.
     * But the amount is limited not to be zero by UI.
     * @param {*} product
     * @param {*} amount
     * @returns
     */
    async updateCart(product: Product, amount: number): Promise<Cart> {
        const cartProductItemIndex = this.cartItems.findIndex(
            item => item.product.pKey === product.pKey,
        );
        const cartProductItem = this.cartItems[cartProductItemIndex];

        if (amount === 0 && cartProductItemIndex === -1) {
            return this;
        }

        if (amount === 0 && cartProductItemIndex > -1) {
            this.cartItems.splice(cartProductItemIndex, 1);
        }

        if (amount > 0) {
            if (cartProductItemIndex === -1) {
                this.cartItems.push({
                    product,
                    quantity: amount,
                    price: product.price * amount,
                });
            } else {
                cartProductItem.quantity = amount;
                cartProductItem.price = cartProductItem.product.price * amount;
            }
        }

        this.calculateTotalPrice();
        this.hasCart = this.cartItems.length > 0;
        this.save();
        await this.updateTaxAndShipAmount();

        return this
    }

    /**
     * updates billing address
     * @param {*} address
     */
    updateBillingAddress = async (address: Address, isValid = true): Promise<Cart> => {
        this.billingAddress = address;
        this.isValidBillingAddress = isValid;

        if (!this.useDiffShippingAddress) {
            this.shippingAddress = address;
            this.isValidShippingAddress = isValid;
        }
        this.save();
        await this.updateTaxAndShipAmount();
        return this
    };

    /**
     * Get Shipping cost and Tax rate from printful according to the order items
     */
    updateTaxAndShipAmount = async (): Promise<Cart> => {
        if (!this.billingAddress || !this.isValidBillingAddress) {
            console.warn("Billing address is invalid")
            return this;
        }

        this.isUpdating = true;
        this.trigger("update")

        try {
            if (this.hasCart && this.isValidBillingAddress) {
                if (typeof this.eventHandlers["rates"] === 'function') {
                    await this.trigger('rates');
                    this.calculateTotalPrice();
                }
            }
        } catch (error: unknown) {
            console.error(error)
        }

        this.isUpdating = false;
        this.save();
        return this
    };

    /**
     * updates shipping address
     * @param {*} address
     */
    updateShippingAddress = (address: Address) => {
        this.shippingAddress = address;
    };

    // clears cart from the local storage
    clearCart() {
        this.resetCart();
        localStorage.removeItem(this.getKey());
        this.trigger("update")
    }

    /**
     * Update coupon code
     * @param {*} coupon
     */
    updateCouponCode(coupon: string) {
        this.coupon = coupon;
        this.save();
    }

    /**
     *  redeem coupon price
     */
    redeemCoupon() {}

    async createOrder(data: Record<string, any>): Promise<any> {
        if (!this.isUpdating) {
            return await this.trigger("submit", data)
        } else {
            console.warn("Your cart is in updating, Try again a little later.")
        }
    }

    async trigger(label: EventLabels, data?: any) {
        const handler = this.eventHandlers[label]
        if (typeof handler === 'function') {
            await handler(this, data)
        } else {
            console.warn(label + " handler is undefined")
        }
    }

    on(
        label: EventLabels,
        handler: EventHandler
    ) {
        this.eventHandlers[label] = handler
        return this;
    }
}

export type CartType = Cart

const CartInstance = Cart.getCart()

export default CartInstance;

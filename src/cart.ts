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
     * If true, this is private checkout which means the store is authenticated users' store
     */
    isPrivate = false;

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

    static cartInstance: Cart | null = null;

    constructor(storeName?: string) {
        if (storeName) {
            this.storeName = storeName
        }
        this.initialize();
        this.isUpdating = false;
    }

    initialize() {
        const oldCartData = localStorage.getItem(this.getKey());
        if (oldCartData) {
            const cartObject = JSON.parse(oldCartData);
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
        let cart = this as Cart
        if (storeName) {
            cart = Cart.getCart(storeName)
        }
        return JSON.parse(JSON.stringify(cart));
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
        return Cart.cartInstance;
    }

    getKey(storeName?: string): string {
        return LOCAL_STORAGE_KEY + '_' + (storeName || this.storeName) + '_CART';
    }

    enableStripeFee(useStripeFee: boolean): Cart {
        this.useStripeFee = useStripeFee;
        this.initialize();
        this.save();
        return this
    }

    /**
     *  saves cart object to local storage
     */
    save(): Cart {
        if (typeof this.eventHandlers['update'] === 'function') {
            const cartObject = this.getCartData()
            this.eventHandlers['update'](cartObject, this);
        }
        const cartData = JSON.stringify(this);
        localStorage.setItem(this.getKey(), cartData);
        return this
    }

    /**
     * Setter for additional Fee
     */
    setAdditionalFee(fee: number) {
        this.additionalFee = fee
    }

    calculateTax(): void {
        if (typeof this.eventHandlers['price.tax'] === 'function') {
            this.eventHandlers['price.tax'](this)
        } else {
            this.taxAmount = 0
            if (this.taxRate) {
                this.taxAmount = (this.subTotalPrice + this.shippingAmount) * this.taxRate;
            }
        }
    }

    calculateStripeFee(): void {
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

    calculateShippingCost(): void {
        if (typeof this.eventHandlers['price.shipping'] === 'function') {
            this.eventHandlers['price.shipping'](this)
        } else {
            this.shippingCost = this.shippingAmount + this.stripeFee;
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
        await this.updateTaxAndShipAmount();
        this.save();
        return this
    };

    /**
     * Get Shipping cost and Tax rate from printful according to the order items
     */
    updateTaxAndShipAmount = async (): Promise<Cart> => {
        if (!this.isValidBillingAddress) {
            console.log("Billing address is invalid")
            return this;
        }

        this.save();

        const items: any[] = [];
        for (const cartItem of this.cartItems) {
            const curProduct = cartItem.product;

            items.push({
                // used for printful api
                name: curProduct.name,
                frontDesignUrl: curProduct.designImage,
                backDesignUrl: curProduct.backDesignImage,

                // used for send order email
                productImg: curProduct.image,
                backProductImg: curProduct.backImage,
                slug: curProduct.slug,
                productStatus: curProduct.slug === 'Case' ? true : curProduct.slug === 'poster',
                color_code: curProduct.color_code,
                color_label: curProduct.color_label,
                size: curProduct.size,
                price: curProduct.price,

                // used for order creation
                vendorProduct: curProduct.id,
                productMapping: curProduct.mappingId,
                quantity: cartItem.quantity,
                variant_id: curProduct.variantId,
                value: curProduct.price,
            });
        }

        if (!this.billingAddress) {
            throw new Error("Billing address is null")
        }

        // https://developers.printful.com/docs/#operation/createOrder
        const shipData = {
            recipient: {
                name: `${this.billingAddress.firstName} ${this.billingAddress.lastName}`,
                company: '',
                address1: this.billingAddress.street,
                address2: this.billingAddress.aptNo,
                city: this.billingAddress.city,
                state_code: this.billingAddress.state,
                state_name: this.billingAddress.state,
                country_code: this.billingAddress.country,
                country_name: this.billingAddress.country,
                zip: this.billingAddress.zip,
                phone: this.billingAddress.phoneNumber,
                email: this.billingAddress.email,
                tax_number: this.billingAddress.cpfNumber,

                state: this.billingAddress.state,
                firstName: this.billingAddress.firstName,
                lastName: this.billingAddress.lastName,
                street: this.billingAddress.street,
                country: this.billingAddress.country,
            },
            items: items,
            currency: 'USD',
            locale: 'en_US',
        };

        this.shipData = shipData;

        if (typeof this.eventHandlers["rates"] === 'function') {
            this.isUpdating = true;
            await this.eventHandlers["rates"](this, shipData);
            this.calculateTotalPrice();
            this.isUpdating = false;
            this.save();
        }

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
    clearCart(storeName?: string) {
        this.resetCart();
        localStorage.removeItem(this.getKey(storeName));
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

    createOrder(data: Record<string, any>) {
        if (typeof this.eventHandlers['submit'] === 'function') {
            this.eventHandlers['submit'](this, data)
        } else {
            console.error("orderSubmitHandler is undefined")
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

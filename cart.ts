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
     * Stripe free = (subtotal + tax + shipping amount) * 0.049 (4.9%) + 0.3
     */
    shippingCost: number = 0;

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

    // Update Cart Callback
    updateHandler: ((cart: any) => void) | null = null;

    // Create/Submit Order Callback
    orderSubmitHandler: ((options: any) => void) | null = null;

    // Callback function to get Tax and Shipping Rate
    getTaxAndShippingRates: ((shipData: Record<string, any>) => Promise<{ taxRate?: number, shippingRate?: number }>) | null = null

    // indicates loading status when calculating tax and shipping rates
    isUpdating = false;

    static cartInstance: Cart | null = null;

    constructor(storeName?: string) {
        if (storeName) {
            this.storeName = storeName;
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

    setStoreName(storeName: string) {
        if (storeName) {
            this.storeName = storeName
            this.save()
        }
    }

    getCartData(): Cart {
        return JSON.parse(JSON.stringify(this));
    }

    resetCart() {
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
    }

    /**
     * @returns new cart object
     */
    static getCart(storeName?: string) {
        if (!Cart.cartInstance) {
            Cart.cartInstance = new Cart(storeName);
        }
        return Cart.cartInstance;
    }

    getKey() {
        const isPrivate = localStorage.getItem('CHECKOUT_PRIVATE');

        if (this.isPrivate !== null) {
            this.isPrivate = isPrivate === 'true';
        }

        if (this.isPrivate) {
            return LOCAL_STORAGE_KEY + '_' + this.storeName + '_PRIVATE';
        } else {
            return LOCAL_STORAGE_KEY + '_' + this.storeName + '_PUBLIC';
        }
    }

    setPrivate(isPrivate: boolean) {
        this.isPrivate = isPrivate;
        this.initialize();
        this.save();
    }

    /**
     *  saves cart object to local storage
     */
    save() {
        if (typeof this.updateHandler === 'function') {
            const cartObject = this.getCartData()
            this.updateHandler(cartObject);
        }
        const cartData = JSON.stringify(this);
        localStorage.setItem(this.getKey(), cartData);
    }

    /**
     *  calculates total price, subtotal, total quantity
     */
    calculateTotalPrice() {
        this.subTotalPrice = 0;
        this.totalQuantity = 0;

        for (const cartItem of this.cartItems) {
            this.subTotalPrice += cartItem.product.price * cartItem.quantity;
            this.totalQuantity += cartItem.quantity;
        }

        if (this.taxRate) {
            if (this.isPrivate) {
                /*
                 * Private Checkout Private Checkout.
                 *
                 * Printful Shipping + 4.9% + .3
                 * Printful Tax
                 */
                this.taxAmount = (this.subTotalPrice + this.shippingAmount) * this.taxRate;
                const stripeFee =
                    (this.subTotalPrice + this.taxAmount + this.shippingAmount) * 0.049 + 0.3;
                this.shippingCost = this.shippingAmount + stripeFee;
            } else {
                /*
                 * Public Checkout Private Checkout.
                 *
                 * Shipping = Printful Shipping + 1.97
                 * Tax = Printful Tax + 1.47
                 * Don't charge stripe fee for public
                 */
                this.shippingCost = this.shippingAmount + 1.97;
                this.taxAmount = (this.subTotalPrice + this.shippingCost) * this.taxRate + 1.47;
            }
        }

        /*
         * Shipping = Shipment cost + Stripe Free
         * Total = Sub Total + Tax + Shipping
         */
        this.totalPrice = this.subTotalPrice + this.taxAmount + this.shippingCost;

        this.taxAmount = Number(this.taxAmount.toFixed(2));
        this.totalPrice = Number(this.totalPrice.toFixed(2));
    }

    /**
     *  adds a product to cart items, if the product already exists in cart items, just increase quantity
     */
    async addCart(product: Product) {
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
    }

    /**
     * remove a product from the cart items
     * @param {*} product
     */
    async removeCartItem(product: Product) {
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
    }

    /**
     * updates the quantity of the product from the cart items
     * If the amount is zero, the product will be removed from the cart list.
     * But the amount is limited not to be zero by UI.
     * @param {*} product
     * @param {*} amount
     * @returns
     */
    async updateCart(product: Product, amount: number) {
        const cartProductItemIndex = this.cartItems.findIndex(
            item => item.product.pKey === product.pKey,
        );
        const cartProductItem = this.cartItems[cartProductItemIndex];

        if (amount === 0 && cartProductItemIndex === -1) {
            return;
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
    }

    /**
     * updates billing address
     * @param {*} address
     */
    updateBillingAddress = async (address: Address, isValid = true) => {
        this.billingAddress = address;
        this.isValidBillingAddress = isValid;

        if (!this.useDiffShippingAddress) {
            this.shippingAddress = address;
            this.isValidShippingAddress = isValid;
        }
        await this.updateTaxAndShipAmount();
        this.save();
    };

    /**
     * Get Shipping cost and Tax rate from printful according to the order items
     */
    updateTaxAndShipAmount = async () => {
        if (!this.isValidBillingAddress) {
            return;
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

        if (typeof this.getTaxAndShippingRates === 'function') {
            this.isUpdating = true;
            const { taxRate = 0, shippingRate = 0 } = await this.getTaxAndShippingRates(shipData);

            this.shippingAmount = shippingRate;
            this.taxRate = taxRate;
            this.calculateTotalPrice();

            this.isUpdating = false;
            this.save();
        }
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
        if (typeof this.orderSubmitHandler === 'function') {
            this.orderSubmitHandler(data)
        } else {
            console.error("orderSubmitHandler is undefined")
        }
    }

    on(
        label: "update" | "submit" | "rates",
        handler: any
    ) {
        if (label === 'update') {
            if (typeof handler === 'function') {
                this.updateHandler = handler;
            } else {
                throw new Error('Callback is not a function');
            }
        } else if (label === 'submit') {
            if (typeof handler === 'function') {
                this.orderSubmitHandler = handler;
            } else {
                throw new Error('Callback is not a function');
            }
        } else if (label === 'rates') {
            if (typeof handler === 'function') {
                this.getTaxAndShippingRates = handler;
            } else {
                throw new Error('Callback is not a function');
            }
        }
        return this;
    }
}

export type CartType = Cart

const CartInstance = Cart.getCart()

export default CartInstance;

const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const roundMoney = (amount) => Math.round(amount * 100) / 100;

// Which status an order may move to next
const allowedTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
};

const getPagination = (query) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
    return { page, limit, skip: (page - 1) * limit };
};

// Give stock back to products (used for rollbacks and cancelled orders)
const restoreStock = async(items) => {
    for (const item of items) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
    }
};

// POST /api/orders
// Items come from req.body.items, or from the user's cart if none are sent.
// Prices and the total are ALWAYS taken from the database, never from the client.
const createOrder = async(req, res, next) => {
    try {
        const { shippingAddress, paymentMethod = 'mock_card' } = req.body;

        // 1. Decide which items to order
        let cart = null;
        let requestedItems;

        if (req.body.items) {
            requestedItems = req.body.items;
        } else {
            cart = await Cart.findOne({ user: req.user._id });
            if (!cart || cart.items.length === 0) {
                return next(createError('Your cart is empty. Add items to the cart or send items in the request', 400));
            }
            requestedItems = cart.items.map((item) => ({
                productId: item.product.toString(),
                quantity: item.quantity,
            }));
        }

        // 2. Merge duplicates (same product listed twice)
        const quantityByProduct = new Map();
        requestedItems.forEach((item) => {
            quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) || 0) + item.quantity);
        });

        // 3. Load products, validate they exist and have enough stock, calculate total
        const products = await Product.find({ _id: { $in: [...quantityByProduct.keys()] } });
        const productById = new Map(products.map((product) => [product._id.toString(), product]));

        const orderItems = [];
        let totalAmount = 0;

        for (const [productId, quantity] of quantityByProduct) {
            const product = productById.get(productId);

            if (!product) {
                return next(createError(`Product not found: ${productId}`, 404));
            }

            if (product.stock < quantity) {
                return next(
                    createError(`Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${quantity}`, 400)
                );
            }

            orderItems.push({ product: product._id, name: product.name, price: product.price, quantity });
            totalAmount += product.price * quantity;
        }

        totalAmount = roundMoney(totalAmount);

        // 4. Reduce stock. Each update only succeeds if enough stock is still left,
        //    so two customers cannot buy the last item at the same time.
        const reducedItems = [];
        let order;

        try {
            for (const item of orderItems) {
                const updated = await Product.findOneAndUpdate({ _id: item.product, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } });

                if (!updated) {
                    throw createError(`"${item.name}" just went out of stock. Please try again`, 409);
                }
                reducedItems.push(item);
            }

            // 5. Create the order. Mock payment: card is marked paid, cash on delivery stays pending.
            order = await Order.create({
                user: req.user._id,
                items: orderItems,
                totalAmount,
                shippingAddress,
                paymentMethod,
                paymentStatus: paymentMethod === 'mock_card' ? 'paid' : 'pending',
                orderStatus: 'pending',
            });
        } catch (error) {
            await restoreStock(reducedItems); // undo any stock changes if something failed
            return next(error);
        }

        // 6. Empty the cart when the order was made from it
        if (cart) {
            cart.items = [];
            await cart.save();
        }

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/orders  (the logged-in user's own orders)
const getMyOrders = async(req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const filter = { user: req.user._id };

        const total = await Order.countDocuments(filter);
        const orders = await Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

        res.status(200).json({
            success: true,
            message: 'Orders fetched successfully',
            data: orders,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/orders/all  (admin) Query: orderStatus, paymentStatus, page, limit
const getAllOrders = async(req, res, next) => {
    try {
        const { orderStatus, paymentStatus } = req.query;
        const filter = {};

        if (orderStatus !== undefined) {
            if (!Order.ORDER_STATUSES.includes(orderStatus)) {
                return next(createError(`orderStatus must be one of: ${Order.ORDER_STATUSES.join(', ')}`, 400));
            }
            filter.orderStatus = orderStatus;
        }

        if (paymentStatus !== undefined) {
            if (!Order.PAYMENT_STATUSES.includes(paymentStatus)) {
                return next(createError(`paymentStatus must be one of: ${Order.PAYMENT_STATUSES.join(', ')}`, 400));
            }
            filter.paymentStatus = paymentStatus;
        }

        const { page, limit, skip } = getPagination(req.query);

        const total = await Order.countDocuments(filter);
        const orders = await Order.find(filter)
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            message: 'All orders fetched successfully',
            data: orders,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/orders/:id  (the owner or an admin)
const getOrderById = async(req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return next(createError('Order not found', 404));
        }

        const isOwner = order.user.toString() === req.user._id.toString();
        if (!isOwner && req.user.role !== 'admin') {
            return next(createError('You do not have permission to view this order', 403));
        }

        await order.populate('user', 'name email');

        res.status(200).json({
            success: true,
            message: 'Order fetched successfully',
            data: order,
        });
    } catch (error) {
        next(error);
    }
};

// PUT /api/orders/:id/status  (admin)   Body: { orderStatus?, paymentStatus? }
const updateOrderStatus = async(req, res, next) => {
    try {
        const { orderStatus, paymentStatus } = req.body;

        const order = await Order.findById(req.params.id);
        if (!order) {
            return next(createError('Order not found', 404));
        }

        let shouldRestoreStock = false;

        if (orderStatus !== undefined) {
            if (orderStatus === order.orderStatus) {
                return next(createError(`Order is already ${orderStatus}`, 400));
            }

            if (!allowedTransitions[order.orderStatus].includes(orderStatus)) {
                return next(createError(`Cannot change order status from ${order.orderStatus} to ${orderStatus}`, 400));
            }

            if (orderStatus === 'cancelled') {
                shouldRestoreStock = true;
                if (order.paymentStatus === 'paid' && paymentStatus === undefined) {
                    order.paymentStatus = 'refunded';
                }
            }

            if (orderStatus === 'delivered' && order.paymentStatus === 'pending' && paymentStatus === undefined) {
                order.paymentStatus = 'paid'; // cash on delivery is collected on delivery
            }

            order.orderStatus = orderStatus;
        }

        if (paymentStatus !== undefined) {
            order.paymentStatus = paymentStatus;
        }

        await order.save();

        if (shouldRestoreStock) {
            await restoreStock(order.items);
        }

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: order,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createOrder, getMyOrders, getAllOrders, getOrderById, updateOrderStatus };
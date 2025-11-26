import userModel from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import razorpay from "razorpay";
import transactionModel from "../models/transactionModel.js";

// REGISTER USER
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({ success: false, message: "Missing Details" });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Invalid Email" });
    }

    if (password.length < 8) {
      return res.json({ success: false, message: "Password too short" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await userModel.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({
      success: true,
      token,
      user: { name: user.name },
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// LOGIN USER
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user)
      return res.json({ success: false, message: "User does not exist" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// GET USER CREDITS
const userCredits = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.findById(userId);

    res.json({
      success: true,
      credits: user.creditBalance,
      user: { name: user.name },
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// RAZORPAY INSTANCE
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// BUY CREDITS (CREATE ORDER)
const paymentRazorpay = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    if (!planId)
      return res.json({ success: false, message: "Missing Plan" });

    let credits, amount, plan;

    switch (planId) {
      case "Basic":
        plan = "Basic";
        credits = 25;
        amount = 10;
        break;
      case "Advanced":
        plan = "Advanced";
        credits = 70;
        amount = 30;
        break;
      case "Premier":
        plan = "Premier";
        credits = 150;
        amount = 50;
        break;
      default:
        return res.json({ success: false, message: "Invalid Plan" });
    }

    const transaction = await transactionModel.create({
      userId,
      plan,
      credits,
      amount,
      date: Date.now(),
    });

    const options = {
      amount: amount * 100,
      currency: process.env.CURRENCY,
      receipt: transaction._id,
    };

    razorpayInstance.orders.create(options, (err, order) => {
      if (err) {
        console.log(err);
        return res.json({ success: false, message: "Order Failed" });
      }
      res.json({ success: true, order });
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// VERIFY PAYMENT
const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id } = req.body;

    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
    if (orderInfo.status !== "paid") {
      return res.json({ success: false, message: "Payment Failed" });
    }

    const transactionData = await transactionModel.findById(orderInfo.receipt);
    if (transactionData.payment) {
      return res.json({ success: false, message: "Already Paid" });
    }

    const user = await userModel.findById(transactionData.userId);
    const newCredits = user.creditBalance + transactionData.credits;

    await userModel.findByIdAndUpdate(user._id, { creditBalance: newCredits });
    await transactionModel.findByIdAndUpdate(transactionData._id, {
      payment: true,
    });

    res.json({ success: true, message: "Credits Added" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export {
  registerUser,
  loginUser,
  userCredits,
  paymentRazorpay,
  verifyRazorpay,
};

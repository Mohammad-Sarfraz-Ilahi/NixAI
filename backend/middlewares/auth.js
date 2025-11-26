import jwt from "jsonwebtoken";

const authUser = (req, res, next) => {
    const token = req.headers.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Not Authorized. Token missing!" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.id) {
            return res.status(401).json({ success: false, message: "Invalid token!" });
        }

        // Store user data safely
        req.user = { id: decoded.id };

        next();
    } catch (err) {
        console.error("JWT Error:", err.message);
        return res.status(401).json({ success: false, message: "Token expired or invalid!" });
    }
};

export default authUser;

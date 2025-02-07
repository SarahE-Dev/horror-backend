const { User, Post, Comment } = require('../models');
const { ValidationError, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register new user
exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { email },
                    { username }
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email or username already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            username,
            email,
            password: hashedPassword
        });

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token
        });

    } catch (error) {
        console.error('Error in register:', error);
        if (error instanceof ValidationError) {
            return res.status(400).json({
                success: false,
                error: error.errors.map(e => e.message)
            });
        }
        res.status(500).json({
            error: error.message
        });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide email and password'
            });
        }

        // Find user
        const user = await User.findOne({ 
            where: { email },
            attributes: ['id', 'username', 'email', 'password', 'createdAt']
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Remove password from response
        const userResponse = user.toJSON();
        delete userResponse.password;

        res.json({
            token
        });

    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({
            success: false,
            error: 'Error logging in'
        });
    }
};

// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'email', 'createdAt'],
            include: [
                {
                    model: Post,
                    as: 'posts',
                    attributes: ['id', 'title', 'createdAt'],
                    limit: 5,
                    order: [['createdAt', 'DESC']]
                },
                {
                    model: Comment,
                    as: 'comments',
                    attributes: ['id', 'content', 'createdAt'],
                    limit: 5,
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Error in getProfile:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching profile'
        });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { username, email, currentPassword, newPassword } = req.body;
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // If updating password, verify current password
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Current password is required to set new password'
                });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Current password is incorrect'
                });
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            user.password = hashedPassword;
        }

        // Update other fields if provided
        if (username) user.username = username;
        if (email) user.email = email;

        await user.save();

        // Remove password from response
        const userResponse = user.toJSON();
        delete userResponse.password;

        res.json({
            success: true,
            data: userResponse
        });

    } catch (error) {
        console.error('Error in updateProfile:', error);
        if (error instanceof ValidationError) {
            return res.status(400).json({
                success: false,
                error: error.errors.map(e => e.message)
            });
        }
        res.status(500).json({
            success: false,
            error: 'Error updating profile'
        });
    }
};

// Delete user account
exports.deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Verify password before deletion
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid password'
            });
        }

        await user.destroy();

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error) {
        console.error('Error in deleteAccount:', error);
        res.status(500).json({
            success: false,
            error: 'Error deleting account'
        });
    }
};

// Get user by ID (public profile)
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id, {
            attributes: ['id', 'username', 'createdAt'],
            include: [
                {
                    model: Post,
                    as: 'posts',
                    attributes: ['id', 'title', 'createdAt'],
                    limit: 10,
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Error in getUserById:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching user'
        });
    }
};

// Search users
exports.searchUsers = async (req, res) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const users = await User.findAndCountAll({
            where: {
                username: {
                    [Op.iLike]: `%${query}%`
                }
            },
            attributes: ['id', 'username', 'createdAt'],
            limit: parseInt(limit),
            offset: offset,
            order: [['username', 'ASC']]
        });

        const totalPages = Math.ceil(users.count / limit);

        res.json({
            success: true,
            data: users.rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalItems: users.count,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error in searchUsers:', error);
        res.status(500).json({
            success: false,
            error: 'Error searching users'
        });
    }
};

// Password reset request
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Store reset token and expiry in user record
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
        await user.save();

        // TODO: Send reset email with token
        // This would typically involve setting up an email service

        res.json({
            success: true,
            message: 'Password reset email sent'
        });

    } catch (error) {
        console.error('Error in requestPasswordReset:', error);
        res.status(500).json({
            success: false,
            error: 'Error requesting password reset'
        });
    }
};

// Reset password
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({
            where: {
                id: decoded.id,
                resetToken: token,
                resetTokenExpiry: {
                    [Op.gt]: Date.now()
                }
            }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and clear reset token
        user.password = hashedPassword;
        user.resetToken = null;
        user.resetTokenExpiry = null;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        console.error('Error in resetPassword:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid reset token'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Error resetting password'
        });
    }
};
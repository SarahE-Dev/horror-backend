'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Post extends Model {
    /**
     * Associations can be defined here.
     */
    static associate(models) {
      // Define association between Post and User
      Post.belongsTo(models.User, { foreignKey: 'userId', as: 'author' });
      Post.hasMany(models.Comment, { foreignKey: 'postId', as: 'comments' });
    }
  }
  Post.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      // Additional fields if needed
    },
    {
      sequelize,
      modelName: 'Post',
    }
  );
  return Post;
};
const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    // Cover images are uploaded to Cloudinary, so only the URL is stored
    // here. Collections without a cover fall back to their first recipe.
    coverImage: {
      type: String,
      trim: true,
      default: "",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Recipes are stored as references so the full recipe documents are
    // never duplicated inside a collection.
    recipes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Recipe",
      },
    ],
    // Present only while the owner has public sharing turned on, so
    // clearing it revokes the old link. It is never returned by the
    // public endpoint.
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Collections are listed per user, newest first.
collectionSchema.index({ user: 1, createdAt: -1 });

const Collection = mongoose.model("Collection", collectionSchema);

module.exports = Collection;

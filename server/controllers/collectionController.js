const Collection = require("../models/Collection");
const Recipe = require("../models/Recipe");
const { createShareToken } = require("../utils/shareToken");

// Same page clamps as the recipe list so both endpoints behave alike.
const MAX_PAGE_LIMIT = 50;
const DEFAULT_PAGE_LIMIT = 10;

// Shapes a collection for the owner-only responses. The share token is part
// of these because the owner needs it to copy their own public link; the
// public endpoint below never returns it.
const buildCollectionSummary = (collection, fallbackCoverImage) => {
  return {
    _id: collection._id,
    name: collection.name,
    description: collection.description || "",
    recipeCount: collection.recipes.length,
    coverImage: collection.coverImage || fallbackCoverImage || null,
    shareToken: collection.shareToken || null,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
};

// Read-only view of a shared collection. Only the fields needed to render the
// public page are listed, so owner details never leave the API.
const buildPublicCollection = (collection) => {
  const recipes = collection.recipes.filter((recipe) => recipe && recipe._id);

  return {
    name: collection.name,
    description: collection.description || "",
    coverImage: collection.coverImage || recipes[0]?.image || null,
    recipeCount: recipes.length,
    recipes: recipes.map((recipe) => ({
      _id: recipe._id,
      title: recipe.title,
      image: recipe.image || "",
      category: recipe.category || "",
    })),
  };
};


// Shapes a collection document for responses that include its recipes.
const buildCollectionDetail = (collection) => {
  return {
    _id: collection._id,
    name: collection.name,
    recipeCount: collection.recipes.length,
    recipes: collection.recipes,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
};

// Checks that the collection exists and belongs to the signed-in user.
// Returns an error status/message when it does not.
const findOwnedCollection = async (collectionId, userId) => {
  const collection = await Collection.findById(collectionId);

  if (!collection) {
    return {
      collection: null,
      errorStatus: 404,
      errorMessage: "Collection not found",
    };
  }

  if (String(collection.user) !== String(userId)) {
    return {
      collection: null,
      errorStatus: 403,
      errorMessage: "You are not allowed to access this collection.",
    };
  }

  return {
    collection,
    errorStatus: null,
    errorMessage: null,
  };
};

// POST /api/collections
const createCollection = async (req, res, next) => {
  try {
    const collection = await Collection.create({
      name: req.body.name.trim(),
      description: req.body.description ?? "",
      coverImage: req.body.coverImage ?? "",
      user: req.user._id,
      recipes: [],
    });

    return res.status(201).json({
      message: "Collection created successfully.",
      collection: buildCollectionSummary(collection, null),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/collections
// Server-side pagination: the database query itself is limited, so only
// the current page of collections is ever fetched.
const getMyCollections = async (req, res, next) => {
  try {
    const currentPage = Math.max(Number(req.query.page) || 1, 1);

    const pageLimit = Math.min(
      Math.max(Number(req.query.limit) || DEFAULT_PAGE_LIMIT, 1),
      MAX_PAGE_LIMIT
    );

    const skip = (currentPage - 1) * pageLimit;

    const [collections, total] = await Promise.all([
      Collection.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      Collection.countDocuments({ user: req.user._id }),
    ]);

    // The first recipe of each collection provides the fallback cover
    // image, so only those recipes are fetched in a single query.
    const firstRecipeIds = collections
      .map((collection) => collection.recipes[0])
      .filter(Boolean);

    const firstRecipes = await Recipe.find({
      _id: { $in: firstRecipeIds },
    }).select("image");

    const imageByRecipeId = new Map(
      firstRecipes.map((recipe) => [
        String(recipe._id),
        recipe.image,
      ])
    );

    const shapedCollections = collections.map((collection) => {
      const firstRecipeId = collection.recipes[0]
        ? String(collection.recipes[0])
        : null;

      const coverImage = firstRecipeId
        ? imageByRecipeId.get(firstRecipeId)
        : null;

      return buildCollectionSummary(collection, coverImage);
    });

    return res.status(200).json({
      collections: shapedCollections,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages: Math.ceil(total / pageLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/collections/:id/recipes
const addRecipeToCollection = async (req, res, next) => {
  try {
    const { collection, errorStatus, errorMessage } =
      await findOwnedCollection(req.params.id, req.user._id);

    if (!collection) {
      return res.status(errorStatus).json({
        message: errorMessage,
      });
    }

    const recipe = await Recipe.findById(req.body.recipeId);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const isAlreadySaved = collection.recipes.some(
      (savedRecipeId) =>
        String(savedRecipeId) === String(recipe._id)
    );

    if (isAlreadySaved) {
      return res.status(409).json({
        message: "This recipe is already in the collection.",
      });
    }

    collection.recipes.push(recipe._id);

    await collection.save();

    return res.status(200).json({
      message: "Recipe added to the collection.",
      recipeCount: collection.recipes.length,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/collections/:id/recipes/:recipeId
const removeRecipeFromCollection = async (req, res, next) => {
  try {
    const { collection, errorStatus, errorMessage } =
      await findOwnedCollection(req.params.id, req.user._id);

    if (!collection) {
      return res.status(errorStatus).json({
        message: errorMessage,
      });
    }

    const recipeIdToRemove = req.params.recipeId;

    const originalCount = collection.recipes.length;

    collection.recipes = collection.recipes.filter(
      (savedRecipeId) =>
        String(savedRecipeId) !== recipeIdToRemove
    );

    if (collection.recipes.length === originalCount) {
      return res.status(404).json({
        message: "This recipe is not in the collection.",
      });
    }

    await collection.save();

    return res.status(200).json({
      message: "Recipe removed from the collection.",
      recipeCount: collection.recipes.length,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/collections/:id
const getCollectionById = async (req, res, next) => {
  try {
    const { collection, errorStatus, errorMessage } =
      await findOwnedCollection(req.params.id, req.user._id);

    if (!collection) {
      return res.status(errorStatus).json({
        message: errorMessage,
      });
    }

    // Recipes are populated as references, keeping insertion order so
    // the first recipe added stays first.
    await collection.populate({
      path: "recipes",
      select: "title image category",
    });

    return res.status(200).json({
      collection: buildCollectionDetail(collection),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/collections/:id/cover
// Only the owner can change a collection cover. An empty string removes it,
// which brings back the first-recipe fallback on the cards.
const updateCollectionCover = async (req, res, next) => {
  try {
    const { collection, errorStatus, errorMessage } =
      await findOwnedCollection(req.params.id, req.user._id);

    if (!collection) {
      return res.status(errorStatus).json({
        message: errorMessage,
      });
    }

    collection.coverImage = req.body.coverImage;

    await collection.save();

    return res.status(200).json({
      message: collection.coverImage
        ? "Collection cover updated."
        : "Collection cover removed.",
      collection: buildCollectionSummary(collection, null),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/collections/:id/share
// Sharing is opt-in: the token is only created when the owner asks for it,
// so collections stay private by default.
const enableCollectionSharing = async (req, res, next) => {
  try {
    const { collection, errorStatus, errorMessage } =
      await findOwnedCollection(req.params.id, req.user._id);

    if (!collection) {
      return res.status(errorStatus).json({
        message: errorMessage,
      });
    }

    if (!collection.shareToken) {
      collection.shareToken = createShareToken();

      await collection.save();
    }

    return res.status(200).json({
      message: "Public sharing is on for this collection.",
      collection: buildCollectionSummary(collection, null),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/collections/:id/share/regenerate
// Replaces the token, so any previously copied link stops working.
const regenerateCollectionShare = async (req, res, next) => {
  try {
    const { collection, errorStatus, errorMessage } =
      await findOwnedCollection(req.params.id, req.user._id);

    if (!collection) {
      return res.status(errorStatus).json({
        message: errorMessage,
      });
    }

    collection.shareToken = createShareToken();

    await collection.save();

    return res.status(200).json({
      message: "A new link was created. The old link no longer works.",
      collection: buildCollectionSummary(collection, null),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/collections/:id/share
// Removing the token revokes the public link straight away.
const disableCollectionSharing = async (req, res, next) => {
  try {
    const { collection, errorStatus, errorMessage } =
      await findOwnedCollection(req.params.id, req.user._id);

    if (!collection) {
      return res.status(errorStatus).json({
        message: errorMessage,
      });
    }

    collection.shareToken = undefined;

    await collection.save();

    return res.status(200).json({
      message: "Public sharing is off. The old link no longer works.",
      collection: buildCollectionSummary(collection, null),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/collections/:token
// Public and read-only. Collections without a matching token - because they
// were never shared, sharing was switched off, or the link was regenerated -
// are not returned at all.
const getSharedCollection = async (req, res, next) => {
  try {
    const collection = await Collection.findOne({
      shareToken: req.params.token,
    }).populate({
      path: "recipes",
      select: "title image category",
    });

    if (!collection) {
      return res.status(404).json({
        message: "This shared collection is not available.",
      });
    }

    return res.status(200).json({
      collection: buildPublicCollection(collection),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCollection,
  getMyCollections,
  getCollectionById,
  addRecipeToCollection,
  removeRecipeFromCollection,
  updateCollectionCover,
  enableCollectionSharing,
  regenerateCollectionShare,
  disableCollectionSharing,
  getSharedCollection,
};


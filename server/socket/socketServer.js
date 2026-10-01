const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

// Every signed-in user gets a private room named after their verified id.
// A socket only ever joins the room of the token it connected with.
const userRoom = (userId) => `user:${userId}`;

// Kept in a module level variable so controllers can emit without having a
// reference to the running server. It stays null until initSocket runs, so
// the REST test suite keeps working without a socket server.
let io = null;

const readHandshakeToken = (socket) => {
  const authToken = socket.handshake.auth?.token;

  if (typeof authToken === "string" && authToken.trim().length > 0) {
    return authToken.trim();
  }

  const authorizationHeader = socket.handshake.headers?.authorization;

  if (
    typeof authorizationHeader === "string" &&
    authorizationHeader.startsWith("Bearer ")
  ) {
    return authorizationHeader.split(" ")[1];
  }

  return null;
};

// Runs before a connection is accepted. Only a token that verifies against
// the existing JWT secret and still belongs to a user is allowed through.
const authenticateSocket = async (socket, next) => {
  try {
    const token = readHandshakeToken(socket);

    if (!token) {
      return next(new Error("Authentication required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("_id");

    if (!user) {
      return next(new Error("Authentication failed."));
    }

    // The id on the socket comes from the verified token, never from a
    // value the client sends in the payload.
    socket.data.userId = String(user._id);

    return next();
  } catch (error) {
    return next(new Error("Authentication failed."));
  }
};

const initSocket = (httpServer, options = {}) => {
  io = new Server(httpServer, {
    cors: {
      origin: options.corsOrigin ?? "*",
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    socket.join(userRoom(socket.data.userId));
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initSocket,
  getIO,
  authenticateSocket,
  userRoom,
};

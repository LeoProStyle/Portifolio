import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema({
  name: String,
  userId: {
    type: String,
    required: true,
    unique: true
  },
  nickname: {
    type: String,
    required: true
  },
  checkIns: {
    type: Number,
    default: 0,
  },
  freeCuts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Client = mongoose.models.Client || mongoose.model("Client", ClientSchema);

import { Schema, model, models, Document } from "mongoose";
import bcrypt from "bcryptjs";

export type UserDoc = Document & {
  email: string;
  name: string;
  password: string;
  role: "admin" | "operador";
  active: boolean;
  comparePassword(plainPassword: string): Promise<boolean>;
};

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "operador"], default: "operador" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre<UserDoc>("save", async function () {
  if (!this.isModified("password")) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (plainPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, this.password);
};

export const UserModel = models.User || model("User", UserSchema);

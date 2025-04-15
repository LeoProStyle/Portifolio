import mongoose from "mongoose";

const connectDB = async () => {

    mongoose.connection.on('connected', () => {
        console.log("conexao estabelecida");
    })

    await mongoose.connect(`${process.env.MONGODB_URI}/spotify`);
}

export default connectDB;
import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITransaction extends Document {
  reference: string
  tickets: Types.ObjectId[]
}

const transactionSchema = new Schema<ITransaction>({
  reference: { type: String, required: true },
  tickets: [{ type: Schema.Types.ObjectId, ref: 'Ticket' }]
})

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
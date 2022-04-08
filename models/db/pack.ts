import { Types } from 'mongoose';

// represents a document from the pathology.packs collection
export default interface Pack {
  _id: Types.ObjectId;
  name: string;
  psychopathId?: number;
  userId: Types.ObjectId;
}

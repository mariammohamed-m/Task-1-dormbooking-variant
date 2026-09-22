import { Booking } from "../models/Booking.js";
import { User } from "../models/User.js";
import Joi from "joi";

// TODO: write a validation schema for create/update per README.md section 2.
const validateDateRange = (value, helpers) => {
  if (value.startDate && value.endDate && value.startDate >= value.endDate) {
    return helpers.message("{#label} must be before endDate");
  }
  return value;
};

const createBookingSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  roomNumber: Joi.string().required(),
  purpose: Joi.string(),
  bookedBy: Joi.string(),
}).custom(validateDateRange);

const updateBookingSchema = Joi.object({
  startDate: Joi.date(),
  endDate: Joi.date(),
  roomNumber: Joi.string(),
  purpose: Joi.string(),
  bookedBy: Joi.string(),
}).custom(validateDateRange);

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.
export async function checkBookingConflicts(booking) {
  const { roomNumber, startDate, endDate } = booking;

  const existingBookings = await Booking.find({ roomNumber });

  for (const existingBooking of existingBookings) {
    if (
      existingBooking._id.toString() !== booking._id?.toString() &&
      ((existingBooking.startDate <= startDate &&
        existingBooking.endDate >= startDate) ||
        (existingBooking.startDate <= endDate &&
          existingBooking.endDate >= endDate))
    ) {
      return true;
    }
  }
  return false;
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate("bookedBy", "name email")
      .lean();
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .select(
        "roomNumber startDate endDate purpose bookedBy createdAt updatedAt",
      )
      .populate("bookedBy", "name email createdAt")
      .lean();

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
// checkBookingConflicts() will be used to check for conflicts with existing bookings.
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createBookingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    if (value.bookedBy) {
      const existingUser = await User.findById(value.bookedBy);
      if (!existingUser)
        return res.status(400).json({ message: "Invalid bookedBy user ID" });
    }
    const hasConflict = await checkBookingConflicts(value);
    if (hasConflict)
      return res.status(409).json({ message: "Booking conflict detected" });

    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateBookingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const booking = await Booking.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    }).populate("bookedBy", "name email");

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const hasConflict = await checkBookingConflicts(booking);
    if (hasConflict)
      return res.status(409).json({ message: "Booking conflict detected" });

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

import axios from "axios";
import { Response } from "express";

import { Event } from "./event.model";
import { paystackBankDetails } from "../shared/util/declarations";
import { User } from "../users/user.model";
import { sendEmail } from "../shared/util/mail";

// Load the environment variables as strings
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY as string

export const createEvent = async (values: Record<string, any>) => {
  const event = new Event(values)
  if (!event) {
    throw new Error('An error occured while creating new event')
  }
  await event.save();

  return event.toObject();
}

export const updateEventDetails = async (id: string, details: Record<string, any>) => {
  const updatedEvent = await Event.findByIdAndUpdate(id, details, { new: true })
  await updatedEvent.save()
  
  const { title, organizer, date, time, venue } = updatedEvent

  for (let attendee of updatedEvent.attendees) {
    const receiver = await User.findById(attendee)
    const subject = 'Event Update'
    const emailContent = `
    <p>Dear ${receiver.fullname.split(' ')[0]}, We trust you're doing well.</p>
    <p>We would like to inform you of some updates regarding the event: <span><b>${title}</b></span>;</p>

    <div>
      <ul>
        <li>Date: ${date}</li>
        <li>Time: ${time.start} - ${time.end}</li>
        <li>Venue: ${venue.name}, ${venue.address}</li>
      </ul>
    </div>
    
    <p>We sincerely apologize for any inconveniences these changes may cause.
    We appreciate your understanding and look forward to your presence at the event.</p>
    <br/>
    
    <p>Best Regards,</p>
    <p><b>${organizer.name}</b></p>`

    await sendEmail(receiver, subject, emailContent, null)
  }
}

export const updateEventStatus = async () => {
  const events = await Event.find()

  for (let event of events) {
    const currentTime = new Date().getTime()
    const startTime = new Date(event.time.start).getTime()
    const endTime = new Date(event.time.end).getTime()

    if (currentTime > startTime && currentTime < endTime) {
      event.status = 'Ongoing'
    } else if (currentTime > endTime) {
      event.status = 'Completed'
    }

    await event.save()
  }
}

export const deleteEvent = (id: string) => {
  return Event.deleteOne({ _id: id });
}

export const getBankNames = async () => {
  const banksPerPage: number = 60
  const bankURL = `https://api.paystack.co/bank?country=nigeria&perPage=${banksPerPage}`

  let bankNames: string[];
  const response = await axios.get(bankURL)
  if (response.status === 200) {
    const banks = response.data.data
    bankNames = banks.map((bank: paystackBankDetails) => bank.name)
  } else {
    throw new Error('An error occured while fetching bank information')
  }

  return bankNames;
}

export const createTransferRecipient = async (accountDetails: Record<string, any>, res: Response) => {
  // Extract account details from the given object
  const { accountName, accountNumber, bankName } = accountDetails

  // Get the bank code using the bank name
  let recipientBank: paystackBankDetails;
  const banksPerPage: number = 60
  const bankURL = `https://api.paystack.co/bank?country=nigeria&perPage=${banksPerPage}`
  
  const bankDetails = await axios.get(bankURL)
  if (bankDetails.status === 200) {
    const banks = bankDetails.data.data
    recipientBank = banks.find((bank: paystackBankDetails) => bank.name === bankName)
  } else {
    throw new Error('An error occured while fetching bank information')
  }

  // Check if the account details match and return an error message if there is a mismatch
  const verificationURL = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${recipientBank.code}`
  const verification = await axios.get(verificationURL, {
    headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` }
  })

  if (verification.status === 200) {
    if (verification.data.data.account_name !== accountName) {
      return res.status(400).json({ error: "Failed to verify account details. Kindly input the correct account information" }).end()
    }
  } else {
    throw new Error('An error occured while verifiying account details')
  }

  // Create a new transfer recipient
  const recipientURL = 'https://api.paystack.co/transferrecipient'
  const transferRecipient = await axios.post(recipientURL,
    {
      "type": "nuban",
      "bank_code": recipientBank.code,
      "name": accountName,
      "account_number": accountNumber,
      "currency": "NGN"
    },
    { headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
    }}
  )

  if (transferRecipient.status !== 200) {
    throw new Error('An error occured while creating transfer recipient')
  }
}

export const getCoordinates = async (address: string, res: Response) => {
  // Encode the given address as a URL component
  const encodedAddress = address.replace(/,/g, '').replace(/\s/g, '+')
  const url = `https://geocode.maps.co/search?q=${encodedAddress}&api_key=${GEOCODING_API_KEY}`

  let latitude: string;
  let longitude: string;

  // Get the latitude and longitude from the address information returned by the Geocoding API
  const response = await axios.get(url)
  if (response.status === 200) {
    if (response.data[0] === undefined) { 
      return res.status(400).json({ error: 'Failed to find address on the map and generate coordinates' }).end()
    }

    latitude = response.data[0].lat
    longitude = response.data[0].lon
  }

  // Convert both values to numbers and return in an array
  return [+latitude, +longitude];
}

export const addDiscount = async (id: string, tier: string, dicountDetails: Record<string, any>) => {
  const { price, expirationDate, numberOfTickets } = dicountDetails
  
  const event = await Event.findById(id)
  const expirationTimestamp = new Date(expirationDate).getTime()

  event.tickets.forEach(ticket => {
    if (ticket.tier === tier) {
      ticket.discount = { price, expirationDate: expirationTimestamp, numberOfTickets }
    }
  })
  await event.save()
}
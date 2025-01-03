import { Injectable } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { sendEmail } from "../config/mail";
import logger from "../logger";

@Injectable()
@Processor('mail-queue')
export class MailProcessor {
  private context = MailProcessor.name

  @Process('signup')
  async signup(job: Job) {
    try {
      const receiver = job.data
      const subject = 'Welcome Onboard!'
      const content = 'Thanks for signing up'
  
      await sendEmail(receiver, subject, content);
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing "${job.name}", Job ID: ${job.id}. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('otp')
  async passwordReset(job: Job) {
    try {
      const receiver = job.data
      const subject = 'Password Reset'
      const content = `This is your OTP: ${receiver.otp}. It is valid for one hour.`
  
      await sendEmail(receiver, subject, content);
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing "${job.name}", Job ID: ${job.id}. Error: ${error.message}\n`);
      throw error;
    }
  }
}

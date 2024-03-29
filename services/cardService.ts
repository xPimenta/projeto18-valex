import { faker } from "@faker-js/faker"

import * as cardRepository from "../repositories/cardRepository.js"
import * as paymentRepository from "../repositories/paymentRepository.js"
import * as rechargeRepository from "../repositories/rechargeRepository.js"
import * as employeeRepository from "../repositories/employeeRepository.js"
import { createAndVerifyUniqueCardNumber } from "../utils/createAndVerifyUniqueCardNumber.js"

import { getNowAddAndFormatDate } from "../utils/dateFunctions.js"
import { security } from "../utils/encryptionFunctions.js"
import { formatEmployeeName } from "../utils/formatEmployeeName.js"

export interface InsertResult {
  rowCount: number
}

export async function createCard(
  employee: employeeRepository.Employee,
  cardType: cardRepository.TransactionTypes,
) {
  const cardData = await createCardData(
    employee.id,
    employee.fullName,
    cardType,
  )

  const createdCard = await cardRepository.insert(cardData)

  if (createdCard.rowCount === 0) {
    throw {
      status: 400,
      message: "Something went wrong",
    }
  }
}

async function createCardData(
  employeeId: number,
  employeeFullName: string,
  cardType: cardRepository.TransactionTypes,
  password: string = null,
  isVirtual: boolean = false,
  originalCardId: number = null,
) {
  const cardNumber: string = await createAndVerifyUniqueCardNumber()
  const cardholderName = formatEmployeeName(employeeFullName)
  const securityCode = faker.finance.creditCardCVV()
  const hashSecurityCode = security.encryptSecurityCode(securityCode)
  const expirationDate = getNowAddAndFormatDate(5, "years", "MM/YY")
  const isBlocked: boolean = false

  console.log("🚀 ~ securityCode", securityCode)

  const cardData = {
    employeeId,
    number: cardNumber,
    cardholderName,
    securityCode: hashSecurityCode,
    expirationDate,
    password,
    isVirtual,
    originalCardId,
    isBlocked,
    type: cardType,
  }

  return cardData
}

export async function updateCard(
  id: number,
  cardData: cardRepository.CardUpdateData,
) {
  await cardRepository.update(id, cardData)
}

export async function gatherCardBalanceAndStatements(cardId: number) {
  interface cardBalanceAndStatements {
    balance: number
    transactions: paymentRepository.PaymentWithBusinessName[]
    recharges: rechargeRepository.Recharge[]
  }

  const cardPayments = await paymentRepository.findByCardId(cardId)
  const cardRecharges = await rechargeRepository.findByCardId(cardId)
  const cardBalance = calculateCardBalance(cardPayments, cardRecharges)

  const cardBalanceAndStatements = {
    balance: cardBalance,
    transactions: cardPayments,
    recharges: cardRecharges,
  }

  return cardBalanceAndStatements
}

export function calculateCardBalance(
  payments: paymentRepository.PaymentWithBusinessName[],
  recharges: rechargeRepository.Recharge[],
) {
  const totalRecharge = recharges.reduce(
    (acc: number, current: { amount: number }) => {
      return acc + current.amount
    },
    0,
  )

  const totalSpent = payments.reduce(
    (acc: number, current: { amount: number }) => {
      return acc + current.amount
    },
    0,
  )

  return totalRecharge - totalSpent
}

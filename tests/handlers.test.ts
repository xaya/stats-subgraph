import {
  assert,
  afterEach,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index"

import {
  Address,
  BigInt,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts"

import {
  Registration as RegistrationEvent,
  Transfer as TransferEvent,
} from "../generated/XayaAccounts/IXayaAccounts"

import {
  Address as AddressEntity,
  Name as NameEntity,
  Namespace as NamespaceEntity,
  Registration as RegistrationEntity,
} from "../generated/schema"

import {
  handleRegistration,
  handleTransfer,
  tokenIdToBytes,
} from "../src/handlers"

/* ************************************************************************** */

/* Some addresses to use in tests.  */
const ALICE = Address.fromString ("0x4807cd9e01ca43f6d8b5bc70c59ff64a3433b778")
const BOB = Address.fromString ("0x78ecbc2f0d748be27570a6c33e06458a10cebf8d")

/* Internal counter to produce unique logIndex values.  */
let nextLogIndex: i32 = 0

/**
 * Helper function to compute a dummy "tokenId" from ns and name.
 */
function computeTokenId (ns: String, name: String): BigInt
{
  const bytesId = Bytes.fromI32 (ns.length)
      .concat (Bytes.fromUTF8 (ns))
      .concat (Bytes.fromUTF8 (name))

  return BigInt.fromUnsignedBytes (bytesId)
}

/**
 * Helper function to create a new mock event and also set some
 * dummy values (such as block / transaction / logIndex) on it.
 */
function mockEvent (): ethereum.Event
{
  const ev = newMockEvent ()

  ev.block.timestamp = BigInt.fromI32 (100)
  ev.transaction.hash = Bytes.fromI32 (200)
  ev.logIndex = BigInt.fromI32 (nextLogIndex++)

  ev.parameters = new Array ()

  return ev
}

/* ************************************************************************** */

/**
 * Helper function to create and process a Registration event.
 */
function testRegistration (ns: String, name: String, owner: Address): void
{
  const tokenId = computeTokenId (ns, name)

  const ev = changetype<RegistrationEvent> (mockEvent ())
  ev.parameters.push (
      new ethereum.EventParam ("ns", ethereum.Value.fromString (ns)))
  ev.parameters.push (
      new ethereum.EventParam ("name", ethereum.Value.fromString (name)))
  ev.parameters.push (
      new ethereum.EventParam ("tokenId",
                               ethereum.Value.fromUnsignedBigInt (tokenId)))
  ev.parameters.push (
      new ethereum.EventParam ("owner", ethereum.Value.fromAddress (owner)))

  handleRegistration (ev)
}

/**
 * Helper function to create and process a Transfer event.
 */
function testTransfer (ns: String, name: String,
                       from: Address, to: Address): void
{
  const tokenId = computeTokenId (ns, name)

  const ev = changetype<TransferEvent> (mockEvent ())
  ev.parameters.push (
      new ethereum.EventParam ("from", ethereum.Value.fromAddress (from)))
  ev.parameters.push (
      new ethereum.EventParam ("to", ethereum.Value.fromAddress (to)))
  ev.parameters.push (
      new ethereum.EventParam ("tokenId",
                               ethereum.Value.fromUnsignedBigInt (tokenId)))

  handleTransfer (ev)
}

/* ************************************************************************** */

/**
 * Helper function to assert that an Address exists in the database.
 */
function assertAddress (addr: Address): void
{
  assert.assertNotNull (AddressEntity.load (addr))
}

/**
 * Helper function that checks that a given Namespace entity exists.
 */
function assertNamespace (ns: String): void
{
  const id = Bytes.fromUTF8 (ns)
  assert.fieldEquals ("Namespace", id.toHexString (), "ns", ns)
}

/**
 * Helper function to assert that a Name entry exists and has the given owner.
 * This also checks that it has an associated Registration entry that
 * is consistent.
 */
function assertName (ns: String, name: String, owner: Address): void
{
  const id = tokenIdToBytes (computeTokenId (ns, name))
  const nameEntity = NameEntity.load (id)
  assert.assertNotNull (nameEntity)

  const nsEntity = NamespaceEntity.load (nameEntity!.ns)!

  assert.stringEquals (nsEntity.ns, ns)
  assert.stringEquals (nameEntity!.name, name)
  assert.bytesEquals (nameEntity!.owner, owner)

  assert.i32Equals (nameEntity!.registration.load ().length, 1)
}

/* ************************************************************************** */

afterEach (clearStore)

describe ("Registration", () => {

  test ("creates Address correctly", () => {
    testRegistration ("p", "domob", ALICE)
    testRegistration ("p", "andy", ALICE)
    assertAddress (ALICE)
    assert.notInStore ("Address", BOB.toHexString ())
  })

  test ("creates Namespace correctly", () => {
    testRegistration ("p", "domob", ALICE)
    assertNamespace ("p")
    assert.notInStore ("Namespace", Bytes.fromUTF8 ("g").toHexString ())

    testRegistration ("g", "domob", BOB)
    assertNamespace ("p")
    assertNamespace ("g")
  })

  test ("creates Name entries", () => {
    testRegistration ("p", "domob", ALICE)
    assertName ("p", "domob", ALICE)

    const id = tokenIdToBytes (computeTokenId ("g", "domob"))
    assert.notInStore ("Name", id.toHexString ())

    testRegistration ("g", "domob", BOB)
    assertName ("p", "domob", ALICE)
    assertName ("g", "domob", BOB)
  })

})

describe ("Transfer", () => {

  test ("creates Address correctly", () => {
    testRegistration ("p", "domob", ALICE)
    testTransfer ("p", "domob", ALICE, BOB)
    assertAddress (BOB)
  })

  test ("updates name ownership", () => {
    testRegistration ("p", "domob", ALICE)
    testRegistration ("p", "andy", ALICE)
    assertName ("p", "domob", ALICE)
    assertName ("p", "andy", ALICE)

    testTransfer ("p", "domob", ALICE, BOB)
    assertName ("p", "domob", BOB)
    assertName ("p", "andy", ALICE)
  })

})

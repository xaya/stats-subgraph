import {
  Move as MoveEvent,
  Registration as RegistrationEvent,
  Transfer as TransferEvent,
} from "../generated/XayaAccounts/IXayaAccounts"

import {
  Address as AddressEntity,
  Move as MoveEntity,
  Name as NameEntity,
  Namespace as NamespaceEntity,
  Payment as PaymentEntity,
  Registration as RegistrationEntity,
} from "../generated/schema"

import {
  Address,
  BigInt,
  ByteArray,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts"

/**
 * Converts a token ID given as BigInt to Bytes that can be used
 * as ID in the subgraph.
 */
export function tokenIdToBytes (id: BigInt): Bytes
{
  return Bytes.fromByteArray (ByteArray.fromBigInt (id))
}

/**
 * Constructs a unique ID for an event, based on txhash and log index.
 */
function uniqueIdForEvent (ev: ethereum.Event): Bytes
{
  return ev.transaction.hash.concatI32 (ev.logIndex.toI32 ())
}

/**
 * Creates an Address entity if it doesn't exist already.
 */
function maybeCreateAddress (addr: Address): void
{
  if (AddressEntity.load (addr) == null)
    new AddressEntity (addr).save ()
}

export function handleMove (ev: MoveEvent): void
{
  const nsId = Bytes.fromUTF8 (ev.params.ns)
  const tokenId = tokenIdToBytes (ev.params.tokenId)

  const mvEntity = new MoveEntity (uniqueIdForEvent (ev))
  mvEntity.timestamp = ev.block.timestamp
  mvEntity.name = tokenId
  mvEntity.save ()

  if (ev.params.receiver != Address.zero ())
    {
      const payment = new PaymentEntity (uniqueIdForEvent (ev))
      payment.move = mvEntity.id
      payment.receiver = ev.params.receiver
      payment.amount = ev.params.amount
      payment.save ()
    }
}

export function handleRegistration (ev: RegistrationEvent): void
{
  maybeCreateAddress (ev.params.owner)

  const nsId = Bytes.fromUTF8 (ev.params.ns)
  if (NamespaceEntity.load (nsId) == null)
    {
      const nsEntity = new NamespaceEntity (nsId)
      nsEntity.ns = ev.params.ns
      nsEntity.save ()
    }

  const tokenId = tokenIdToBytes (ev.params.tokenId)
  const nameEntity = new NameEntity (tokenId)
  nameEntity.ns = nsId
  nameEntity.name = ev.params.name
  nameEntity.owner = ev.params.owner
  nameEntity.save ()

  const regEntity = new RegistrationEntity (uniqueIdForEvent (ev))
  regEntity.timestamp = ev.block.timestamp
  regEntity.name = tokenId
  regEntity.save ()
}

export function handleTransfer (ev: TransferEvent): void
{
  maybeCreateAddress (ev.params.to)

  const tokenId = tokenIdToBytes (ev.params.tokenId)
  const nameEntity = NameEntity.load (tokenId)

  /* When a name is registered, it is minted first (which Transfer's from
     the zero address), and later the Registration event is emitted.  In this
     case the name does not exist.  Ignore that, as the registration handler
     will set the owner.  */
  if (nameEntity == null)
    return

  nameEntity.owner = ev.params.to
  nameEntity.save ()
}

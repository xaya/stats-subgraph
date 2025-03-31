import {
  Registration as RegistrationEvent,
} from "../generated/XayaAccounts/IXayaAccounts"

import {
  Address as AddressEntity,
  Name as NameEntity,
  Namespace as NamespaceEntity,
  Registration as RegistrationEntity,
} from "../generated/schema"

import {
  Address,
  BigInt,
  Bytes,
  ethereum,
} from "@graphprotocol/graph-ts"

/**
 * Converts a token ID given as BigInt to Bytes that can be used
 * as ID in the subgraph.
 */
function tokenIdToBytes (id: BigInt): Bytes
{
  /* See https://github.com/protofire/subgraph-toolkit/blob/main/lib/utils.ts
     as an example.  */
  return (id as Uint8Array) as Bytes
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

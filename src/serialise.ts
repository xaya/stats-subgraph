import {
  JSONValue,
  JSONValueKind,
} from "@graphprotocol/graph-ts"

/**
 * Recursively serialises a JSONValue back to a JSON string representation.
 */
export function serialiseJson (value: JSONValue): string
{
  switch (value.kind)
    {
      case JSONValueKind.NULL:
        return "null"
      
      case JSONValueKind.BOOL:
        return value.toBool () ? "true" : "false"
      
      case JSONValueKind.NUMBER:
        /* We want to be able to handle all kind of numbers.  Internally,
           JSONValue stores the data as a string.  We extract that string
           without getting it converted to any specific type of number
           (such as integer or float).  */
        value.kind = JSONValueKind.STRING
        const res = value.toString ()
        value.kind = JSONValueKind.NUMBER
        return res
      
      case JSONValueKind.STRING:
        return escapeJsonString (value.toString ())
      
      case JSONValueKind.ARRAY:
        const array = value.toArray ()
        const arrayElements: string[] = []
        for (let i = 0; i < array.length; i++) {
          arrayElements.push (serialiseJson (array[i]))
        }
        return "[" + arrayElements.join (",") + "]"
      
      case JSONValueKind.OBJECT:
        const object = value.toObject ()
        const objectPairs: string[] = []
        for (let i = 0; i < object.entries.length; i++) {
          const entry = object.entries[i]
          const key = escapeJsonString (entry.key)
          const val = serialiseJson (entry.value)
          objectPairs.push (key + ":" + val)
        }
        return "{" + objectPairs.join (",") + "}"

      default:
        return "error"
    }
}

/**
 * Escapes a string for use in JSON by wrapping it in quotes and escaping
 * special characters according to JSON specification.
 */
function escapeJsonString (str: string): string
{
  let result = '"'
  
  for (let i = 0; i < str.length; i++)
    {
      const charCode = str.charCodeAt (i)
      
      switch (charCode)
        {
          case 34: // '"'
            result += '\\"'
            break
          case 92: // '\\'
            result += '\\\\'
            break
          case 8: // '\b'
            result += '\\b'
            break
          case 12: // '\f'
            result += '\\f'
            break
          case 10: // '\n'
            result += '\\n'
            break
          case 13: // '\r'
            result += '\\r'
            break
          case 9: // '\t'
            result += '\\t'
            break
          default:
            /* Handle other control characters and literal characters.  */
            if (charCode < 32)
              result += '\\u' + charCode.toString (16).padStart (4, '0')
            else
              result += str.charAt (i)
            break
        }
    }
  
  result += '"'
  return result
}

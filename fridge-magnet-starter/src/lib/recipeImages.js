import { supabase } from '../supabaseClient'

const BUCKET = 'recipe-images'

// Phone photos are often 4–10 MB. Shrinking them to 1200 pixels on the
// longest side before uploading makes them roughly 150–300 KB, which keeps
// the page quick on mobile data and the free 1 GB of storage nearly empty.
const MAX_SIDE = 1200

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not read that photo.'))),
        'image/jpeg',
        0.82
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("That file doesn't look like a photo."))
    }
    img.src = url
  })
}

// Uploads a photo into the household's own folder and returns where it
// was saved, e.g. "<household id>/<random id>.jpg".
export async function uploadRecipeImage(householdId, file) {
  const blob = await shrinkImage(file)
  const path = `${householdId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) throw error
  return path
}

// Removes a photo that is no longer used. Failing to delete it is not
// worth stopping the user over, so problems are only logged.
export async function deleteRecipeImage(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.error('Could not delete the old recipe photo', error)
}

// Turns a saved path back into a web address an <img> can show.
export function recipeImageUrl(path) {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

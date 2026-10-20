// Image upload for blog posts: the same Cloudinary upload widget and unsigned preset blogupdate.html uses (the
// cloud name and preset are meant to be public). The blog's Action downloads each image and makes its sizes.
const CLOUD = { cloudName: 'zxhtzlsh', uploadPreset: 'blogupload' }
const SCRIPT = 'https://upload-widget.cloudinary.com/latest/global/all.js'

interface UploadInfo {
  secure_url?: string
  original_filename?: string
  public_id?: string
  format?: string
}
interface CloudinaryGlobal {
  createUploadWidget(options: object, cb: (error: unknown, result: { event?: string; info?: UploadInfo }) => void): { open(): void }
}

let loading: Promise<CloudinaryGlobal> | null = null

function load(): Promise<CloudinaryGlobal> {
  const w = window as unknown as { cloudinary?: CloudinaryGlobal }
  if (w.cloudinary) return Promise.resolve(w.cloudinary)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.onload = () => (w.cloudinary ? resolve(w.cloudinary) : reject(new Error('The image uploader didn’t load.')))
    s.onerror = () => {
      loading = null
      reject(new Error('Couldn’t load the image uploader. Check the connection and try again.'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/** Opens the uploader; calls back with the image's address and a file name once it's uploaded. */
export async function chooseImage(onUploaded: (image: { url: string; fileName: string }) => void): Promise<void> {
  const cloudinary = await load()
  cloudinary
    .createUploadWidget({ ...CLOUD, cropping: true, multiple: false, sources: ['local', 'camera', 'url'] }, (error, result) => {
      if (error || result?.event !== 'success' || !result.info?.secure_url) return
      const info = result.info
      const name = String(info.original_filename || info.public_id || 'image').replace(/[^A-Za-z0-9._-]+/g, '-')
      onUploaded({ url: info.secure_url!, fileName: `${name}${info.format ? `.${info.format}` : ''}` })
    })
    .open()
}

# 🎨 PixelForge AI Generator

PixelForge is an AI-powered Text-to-Image Generator developed using Python, Gradio, and Pollinations.ai. The project allows users to generate high-quality Posters, Banners, and Social Media Designs simply by entering a text prompt.

The application automatically enhances user prompts with smart design keywords to generate more professional and visually attractive outputs. It uses the free Pollinations.ai image generation API, which does not require any API key or authentication.


# 🚀 Features

## ✅ AI Text-to-Image Generation

Generate creative and high-quality images using simple text descriptions.

## ✅ Multiple Design Modes

Supports different design formats:

* Poster
* Banner
* Social Media Post

Each design type automatically uses optimized dimensions and prompt styles.


## ✅ Smart Prompt Engineering

The system automatically improves the user's prompt by adding professional keywords like:

* high quality
* detailed
* cinematic lighting
* vibrant colors
* modern style

This helps generate better AI outputs.

---

## ✅ Free API Integration

Integrated with:

[Pollinations.ai](https://pollinations.ai/?utm_source=chatgpt.com)

No API key or paid subscription required.


## ✅ Interactive Web Interface

Built using:

[Gradio](https://www.gradio.app/?utm_source=chatgpt.com)

Provides an easy-to-use graphical interface for users.


## ✅ Real-Time Image Generation

Generates images instantly from prompts using HTTP requests.


# 🛠 Technologies Used

| Technology      | Purpose                |
| --------------- | ---------------------- |
| Python          | Backend Development    |
| Gradio          | Frontend Web Interface |
| Requests        | API Communication      |
| Pillow (PIL)    | Image Handling         |
| Pollinations.ai | AI Image Generation    |

---

# ⚙ How It Works

## 🔹 Step 1 — User Input

The user enters:

* A text prompt
* Design type selection

Example:

```text id="1fjlwm"
Luxury coffee brand with gold and black theme
```

---

## 🔹 Step 2 — Smart Prompt Builder

The application automatically enhances the prompt.

Example Generated Prompt:

```text id="75jcp4"
Luxury coffee brand with gold and black theme, high quality, detailed, attractive design, poster design, cinematic lighting
```

---

## 🔹 Step 3 — API Request

The enhanced prompt is sent to Pollinations.ai using a URL-based API request.

Example:

```python id="nmdt98"
https://image.pollinations.ai/prompt/{prompt}
```

---

## 🔹 Step 4 — AI Image Generation

Pollinations.ai processes the prompt and generates the image.

---

## 🔹 Step 5 — Display Output

The generated image is displayed inside the Gradio web application.

---

# 📦 Installation

## Install Required Libraries

```bash id="ycmu0r"
pip install gradio requests pillow
```

---

# ▶ Run the Project

```bash id="k5e9d2"
python app.py
```

After running the command, the Gradio interface will open automatically in the browser.

---

# 📸 Supported Design Types

| Design Type  | Resolution |
| ------------ | ---------- |
| Poster       | 512 × 768  |
| Banner       | 1024 × 512 |
| Social Media | 512 × 512  |

---

# 💡 Example Prompts

## Poster

```text id="9l1l4v"
Cyberpunk gaming event poster
```

## Banner

```text id="m4zwjw"
Modern fitness brand website banner
```

## Social Media

```text id="tnx28e"
Luxury skincare Instagram post
```

# 🔥 Advantages of PixelForge

* Beginner Friendly
* No API Key Required
* Fast Image Generation
* Professional Design Output
* Lightweight Architecture
* Easy Deployment

# 📚 Learning Concepts Used

This project demonstrates practical implementation of:

* API Integration
* Prompt Engineering
* Python Backend Development
* Image Processing
* Web Application Development
* AI-based Content Generation

# 🔮 Future Improvements

Future versions of PixelForge may include:

* HD Image Upscaling
* Download Button
* Multiple AI Models
* AI Logo Generator
* Text Overlay System
* User Authentication
* Image History
* Cloud Deployment


PixelForge is a modern AI-powered design generation system that combines Artificial Intelligence, Prompt Engineering, and Web Development into a single application. It simplifies graphic content creation and demonstrates how AI APIs can be integrated into real-world software projects using Python.

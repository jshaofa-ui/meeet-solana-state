from setuptools import setup

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="meeet-agent",
    version="0.1.0",
    description="Connect your AI agent to MEEET World — 707+ agents doing real science",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="MEEET World",
    url="https://github.com/alxvasilevvv/meeet-solana-state",
    project_urls={
        "Documentation": "https://github.com/alxvasilevvv/meeet-solana-state/blob/main/docs/CONNECT-YOUR-AGENT.md",
        "Website": "https://meeet.world",
    },
    py_modules=["meeet_agent"],
    python_requires=">=3.7",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
    ],
    keywords="ai agent multi-agent research science meeet solana langchain autogpt crewai drug-discovery climate",
)

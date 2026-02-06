FROM docker.io/cloudflare/sandbox:0.7.0

# Add opencode install location to PATH before installation
ENV PATH="/root/.opencode/bin:${PATH}"

# Install OpenCode CLI
RUN curl -fsSL https://opencode.ai/install -o /tmp/install-opencode.sh \
    && bash /tmp/install-opencode.sh \
    && rm /tmp/install-opencode.sh \
    && opencode --version

# Create base directory for multi-user workspaces
RUN mkdir -p /home/user/workspaces

# Start in the base workspace directory
WORKDIR /home/user/workspaces

# Expose OpenCode server port
EXPOSE 4096
